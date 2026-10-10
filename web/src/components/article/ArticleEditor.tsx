"use client";

import { Check, Copy, Download, Gauge, PenLine, RotateCcw, Save, Square, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { deleteArticle, restoreRevision, saveArticle, setArticleStatus } from "@/app/article-actions";
import { Badge, Button, Panel, Progress, SystemNotice } from "@/components/ui";
import { extractHeadings, renderMarkdown, wordCount } from "@/lib/markdown";
import type { ContentBrief, WriterMode } from "@/lib/schemas";
import s from "./ArticleEditor.module.css";
import { ScorePanel, type ScoreView } from "./ScorePanel";
import { STATUS_LABEL } from "./status";
import { useWriterStream } from "./useWriterStream";

export type { ScoreView };
export type ArticleData = { id: string; projectId: string; briefId: string | null; targetKeyword: string; title: string; slug: string; metaDescription: string; bodyMarkdown: string; jsonLd: string | null; status: string; model: string; updatedAt: string };
export type RevisionData = { id: string; note: string; bodyMarkdown: string; createdAt: string };
type Props = { article: ArticleData; brief: ContentBrief | null; revisions: RevisionData[]; initialScore: ScoreView | null; canGenerate: boolean; autostart: boolean };

type Tab = "edit" | "preview" | "split";
type Fields = { title: string; slug: string; metaDescription: string; bodyMarkdown: string };
const META_MAX = 155;
const MODE_LABEL: Record<WriterMode, string> = { write: "Claude đang viết", fix: "Claude đang sửa", rewrite: "Claude đang viết lại" };

function prettyJson(raw: string | null): string {
  if (!raw) return "";
  try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
}

export function ArticleEditor({ article, brief, revisions, initialScore, canGenerate, autostart }: Props) {
  const router = useRouter();
  const [fields, setFields] = useState<Fields>({ title: article.title, slug: article.slug, metaDescription: article.metaDescription, bodyMarkdown: article.bodyMarkdown });
  const [saved, setSaved] = useState<Fields>(fields);
  const [status, setStatus] = useState(article.status);
  const [jsonLd, setJsonLd] = useState(article.jsonLd);
  const [tab, setTab] = useState<Tab>(article.bodyMarkdown ? "split" : "edit");
  const [score, setScore] = useState<ScoreView | null>(initialScore);
  const [scoring, setScoring] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "red" | "amber"; title: string; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, startSave] = useTransition();
  const [statusPending, startStatus] = useTransition();
  const [restoring, startRestore] = useTransition();
  const body = fields.bodyMarkdown;
  const dirty = fields.title !== saved.title || fields.slug !== saved.slug || fields.metaDescription !== saved.metaDescription || body !== saved.bodyMarkdown;

  // props đổi sau router.refresh() (writer lưu jsonLd, revision mới) → đồng bộ phần không do người dùng sửa
  useEffect(() => { setJsonLd(article.jsonLd); }, [article.jsonLd]);
  useEffect(() => { setStatus(article.status); }, [article.status]);
  useEffect(() => { if (saveMsg) { const t = setTimeout(() => setSaveMsg(null), 2500); return () => clearTimeout(t); } }, [saveMsg]);

  const set = (patch: Partial<Fields>) => { setFields((f) => ({ ...f, ...patch })); setSaveMsg(null); };

  /* ───── Chấm điểm ───── */
  const runScore = useCallback(async (withAi: boolean) => {
    setScoring(true); setNotice(null);
    try {
      const res = await fetch(`/api/articles/${article.id}/score`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ withAi }) });
      const j = (await res.json()) as (ScoreView & { error?: string }) | { error: string };
      if (!res.ok || "error" in j && j.error) throw new Error(("error" in j && j.error) || `HTTP ${res.status}`);
      setScore(j as ScoreView);
      router.refresh();
    } catch (e) {
      setNotice({ tone: "red", title: "Không chấm điểm được", text: e instanceof Error ? e.message : String(e) });
    } finally { setScoring(false); }
  }, [article.id, router]);

  /* ───── Streaming ───── */
  const writer = useWriterStream(article.id, {
    onDelta: (mode, text) => { if (mode === "write") setFields((f) => ({ ...f, bodyMarkdown: text })); },
    onDone: (_mode, text) => {
      setFields((f) => ({ ...f, bodyMarkdown: text }));
      setSaved((sv) => ({ ...sv, bodyMarkdown: text }));
      setStatus("review");
      setSaveMsg("Đã lưu");
      setTab((t) => (t === "edit" ? "split" : t));
      router.refresh();
      void runScore(false);
    },
    onError: (_mode, message) => { setNotice({ tone: "red", title: "Writer gặp lỗi", text: message }); router.refresh(); },
    // Ngắt kết nối phía client: máy chủ vẫn viết tiếp và tự lưu khi xong → giữ phần đã nhận, không đánh dấu dirty, nhắc tải lại.
    onAbort: (mode, text) => {
      if (mode === "write" && text) { setFields((f) => ({ ...f, bodyMarkdown: text })); setSaved((sv) => ({ ...sv, bodyMarkdown: text })); }
      setNotice({ tone: "amber", title: "Đã ngắt kết nối", text: "Claude vẫn hoàn tất bài trong nền và tự lưu khi xong — tải lại trang sau ít phút để xem bản đầy đủ." });
    },
  });
  const { streaming, mode, incoming } = writer;

  /* ───── Lưu ───── */
  const persist = useCallback(async (note?: string): Promise<boolean> => {
    const snapshot = fields;
    const r = await saveArticle(article.id, snapshot, note);
    if (r.ok) { setSaved(snapshot); setSaveMsg("Đã lưu"); return true; }
    setNotice({ tone: "red", title: "Không lưu được", text: r.error });
    return false;
  }, [article.id, fields]);
  const save = useCallback(() => { if (!dirty || saving || streaming) return; startSave(async () => { await persist(); }); }, [dirty, saving, streaming, persist]);

  const begin = async (m: WriterMode, instruction?: string) => {
    if (!canGenerate || streaming) return;
    if (m === "write" && body.trim() && !window.confirm("Viết lại từ đầu sẽ thay toàn bộ nội dung hiện tại (bản cũ được giữ trong Phiên bản). Tiếp tục?")) return;
    if (dirty && !(await persist("Lưu trước khi gọi Writer"))) return;
    setNotice(null);
    if (m !== "write" && tab === "edit") setTab("preview");
    setStatus("writing");
    void writer.start(m, instruction);
  };

  // autostart sau khi tạo bài: chỉ một lần, bỏ ?autostart khỏi URL để reload không chạy lại
  const autoRef = useRef(false);
  useEffect(() => {
    if (autoRef.current) return;
    autoRef.current = true;
    if (autostart) {
      try { window.history.replaceState(null, "", window.location.pathname); } catch { /* ignore */ }
      if (article.bodyMarkdown === "" && canGenerate) { setStatus("writing"); void writer.start("write"); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  const changeStatus = (next: string) => {
    const prev = status; setStatus(next);
    startStatus(async () => {
      const r = await setArticleStatus(article.id, next as "draft" | "review" | "final");
      if (!r.ok) { setStatus(prev); setNotice({ tone: "red", title: "Không đổi được trạng thái", text: "Thử lại sau." }); } else router.refresh();
    });
  };

  const restore = (rev: RevisionData) => {
    if (!window.confirm(`Khôi phục phiên bản ${new Date(rev.createdAt).toLocaleString("vi-VN")}? Nội dung hiện tại sẽ được lưu thành một phiên bản mới.`)) return;
    startRestore(async () => {
      const r = await restoreRevision(article.id, rev.id);
      if (r.ok) { setFields((f) => ({ ...f, bodyMarkdown: rev.bodyMarkdown })); setSaved((sv) => ({ ...sv, bodyMarkdown: rev.bodyMarkdown })); setSaveMsg("Đã khôi phục"); router.refresh(); }
      else setNotice({ tone: "red", title: "Không khôi phục được", text: r.error });
    });
  };

  const copyJsonLd = async () => {
    try { await navigator.clipboard.writeText(prettyJson(jsonLd)); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setNotice({ tone: "amber", title: "Không copy được", text: "Trình duyệt chặn clipboard — chọn và copy thủ công." }); }
  };

  /* ───── Dẫn xuất ───── */
  const previewSource = streaming && mode !== "write" ? incoming : body;
  const html = useMemo(() => renderMarkdown(previewSource), [previewSource]);
  const words = useMemo(() => wordCount(body), [body]);
  const headings = useMemo(() => extractHeadings(body).length, [body]);
  const incomingWords = useMemo(() => (streaming ? wordCount(incoming) : 0), [streaming, incoming]);
  const metaLen = fields.metaDescription.length;
  const exportBase = `/api/articles/${article.id}/export`;
  const statusText = saveMsg ?? (streaming ? "Đang nhận nội dung…" : dirty ? "Chưa lưu thay đổi" : "Tất cả đã lưu");
  const st = STATUS_LABEL[status] ?? { label: status, tone: "outline" as const };
  const writePrimary = body.trim() === "" && !dirty && !streaming;
  const showPreview = tab !== "edit";
  const showEditor = tab !== "preview";

  return (
    <div className="stack">
      {/* ───── Header ───── */}
      <div className="row-head">
        <div className="text">
          <div className="row" style={{ gap: 8 }}>
            <span className="micro">Bài viết · {article.model}</span>
            <Badge tone={st.tone}>{st.label}</Badge>
            {brief && article.briefId && <Link href={`/projects/${article.projectId}/briefs/${article.briefId}`} className="caption" style={{ textDecoration: "underline" }}>Xem brief</Link>}
          </div>
          <input className={["h1", s.titleInput].join(" ")} value={fields.title} onChange={(e) => set({ title: e.target.value })} aria-label="Tiêu đề bài viết" placeholder="Tiêu đề bài viết" />
          <div className="caption mono">từ khoá: {article.targetKeyword}</div>
        </div>
        <div className={["actions", s.headActions].join(" ")}>
          <span className={[s.status, dirty ? s.dirty : ""].join(" ")} aria-live="polite" role="status">{statusText}</span>
          <Button variant={dirty ? "primary" : "secondary"} iconLeft={<Save size={16} aria-hidden />} onClick={save} loading={saving} disabled={!dirty || streaming} title="Ctrl/⌘ + S">Lưu</Button>
          {streaming ? (
            <Button variant="secondary" iconLeft={<Square size={14} aria-hidden />} onClick={writer.cancel}>Dừng</Button>
          ) : (
            <Button variant={writePrimary ? "primary" : "secondary"} iconLeft={<PenLine size={16} aria-hidden />} onClick={() => begin("write")} disabled={!canGenerate || saving} title={canGenerate ? (body ? "Viết lại toàn bộ bài từ brief" : "Claude viết bài theo brief, stream trực tiếp") : "Chưa có ANTHROPIC_API_KEY"}>Viết bài</Button>
          )}
          <Button variant="secondary" iconLeft={<Gauge size={16} aria-hidden />} onClick={() => runScore(true)} loading={scoring} disabled={streaming || !body.trim()} title={canGenerate ? "Rule engine + Claude chấm GEO" : "Chỉ chấm bằng rule engine (chưa có API key)"}>Chấm điểm</Button>
        </div>
      </div>

      <div className={s.metaGrid}>
        <div className={s.field}>
          <label htmlFor="a-slug">Slug</label>
          <div className={s.slugWrap}><span className={s.slugPrefix} aria-hidden>/</span><input id="a-slug" className={s.slugInput} value={fields.slug} onChange={(e) => set({ slug: e.target.value })} spellCheck={false} autoComplete="off" /></div>
        </div>
        <div className={s.field}>
          <label htmlFor="a-status">Trạng thái</label>
          <select id="a-status" className={s.select} value={status} onChange={(e) => changeStatus(e.target.value)} disabled={streaming || statusPending}>
            <option value="draft">Nháp</option>
            {status === "writing" && <option value="writing" disabled>Đang viết</option>}
            <option value="review">Chờ duyệt</option>
            <option value="final">Hoàn tất</option>
          </select>
        </div>
        <div className={[s.field, s.metaField].join(" ")}>
          <label htmlFor="a-meta">Meta description <span className={["mono", metaLen > META_MAX ? s.over : ""].join(" ")} aria-live="polite">{metaLen}/{META_MAX}</span></label>
          <textarea id="a-meta" className={s.metaInput} value={fields.metaDescription} onChange={(e) => set({ metaDescription: e.target.value })} rows={2} placeholder="≤ 155 ký tự, chứa từ khoá, có lời kêu gọi hành động" />
        </div>
      </div>

      {notice && <SystemNotice tone={notice.tone} title={notice.title} action={<span className="row" style={{ gap: 10, flexWrap: "nowrap" }}>{notice.tone === "amber" && <button type="button" className={s.linkBtn} onClick={() => { setNotice(null); router.refresh(); }}>Tải lại</button>}<button type="button" className={s.linkBtn} onClick={() => setNotice(null)}>Đóng</button></span>}>{notice.text}</SystemNotice>}
      {!canGenerate && <SystemNotice tone="amber">Chưa có ANTHROPIC_API_KEY — vẫn soạn thảo, lưu và chấm bằng rule engine, nhưng Claude không viết hay sửa bài.</SystemNotice>}

      <div className={s.layout}>
        {/* ───── Cột chính ───── */}
        <div className="stack" style={{ gap: 12, minWidth: 0 }}>
          <div className={s.toolbar}>
            <div className={s.tabs} role="tablist" aria-label="Chế độ soạn thảo">
              {([["edit", "Soạn thảo"], ["preview", "Xem trước"], ["split", "Song song"]] as const).map(([k, label]) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} className={[s.tab, tab === k ? s.tabActive : ""].join(" ")} onClick={() => setTab(k)}>{label}</button>
              ))}
            </div>
            <span className={s.spacer} />
            <div className={s.exports} aria-label="Xuất">
              <span className="micro">Xuất</span>
              <a className={s.exportLink} href={`${exportBase}?format=md&download=1`}><Download size={13} aria-hidden />Markdown</a>
              <a className={s.exportLink} href={`${exportBase}?format=html&download=1`}><Download size={13} aria-hidden />HTML</a>
              <a className={s.exportLink} href={`${exportBase}?format=jsonld&download=1`}><Download size={13} aria-hidden />JSON-LD</a>
            </div>
          </div>

          {streaming && mode && <Progress value={null} label={`${MODE_LABEL[mode]}… ${incomingWords} từ`} />}

          <div className={tab === "split" ? s.split : undefined}>
            {showEditor && (
              <textarea className={s.editor} value={body} onChange={(e) => set({ bodyMarkdown: e.target.value })} readOnly={streaming} aria-label="Nội dung Markdown" aria-busy={streaming || undefined} placeholder={canGenerate ? "Bấm “Viết bài” để Claude soạn theo brief, hoặc gõ Markdown tại đây…" : "Gõ Markdown tại đây…"} spellCheck={false} />
            )}
            {showPreview && (
              <div className={s.previewPane} aria-live={streaming ? "polite" : undefined} aria-label="Xem trước">
                {streaming && mode !== "write" && <div className={s.incomingTag}><Badge tone="info">bản sửa đang về</Badge><span className="caption">Sẽ thay vào trình soạn thảo khi hoàn tất.</span></div>}
                {previewSource.trim() ? <article className={s.prose} dangerouslySetInnerHTML={{ __html: html }} /> : <p className="caption">Chưa có nội dung để xem trước.</p>}
              </div>
            )}
          </div>

          <div className={s.footer} aria-live="polite">
            <span className="mono">{words} từ · {body.length} ký tự · {headings} heading</span>
            <span>Cập nhật {new Date(article.updatedAt).toLocaleString("vi-VN")}</span>
          </div>
        </div>

        {/* ───── Aside ───── */}
        <aside className={s.aside}>
          <ScorePanel score={score} scoring={scoring} streaming={streaming} canGenerate={canGenerate} onScore={(withAi) => void runScore(withAi)} onFix={(fix) => void begin("fix", fix)} />

          {brief && (
            <details className={s.details}>
              <summary><span>Brief</span><span className={s.sum}>{brief.outline.length} mục · {brief.wordCountMin}–{brief.wordCountMax} từ</span></summary>
              <div className={s.detailsBody}>
                <div><div className="micro" style={{ marginBottom: 6 }}>Outline</div>
                  <ol className={s.outline}>{brief.outline.map((o, i) => <li key={i} style={{ paddingLeft: (o.level - 1) * 12 }}><span className="micro" style={{ color: o.level === 1 ? "var(--volt)" : undefined, marginRight: 6 }}>H{o.level}</span>{o.heading}</li>)}</ol>
                </div>
                {brief.geoChecklist.length > 0 && <div><div className="micro" style={{ marginBottom: 6 }}>Checklist GEO</div>
                  <ul className={s.plain}>{brief.geoChecklist.map((c) => <li key={c.id} className="body-s"><Badge tone={c.priority === "must" ? "danger" : c.priority === "should" ? "warning" : "neutral"}>{c.priority}</Badge> {c.label}</li>)}</ul>
                </div>}
                {brief.links.length > 0 && <div><div className="micro" style={{ marginBottom: 6 }}>Liên kết</div>
                  <ul className={s.plain}>{brief.links.map((l, i) => <li key={i} className="body-s secondary">→ <b style={{ color: "var(--fg-1)", fontWeight: 500 }}>{l.to}</b> · “{l.anchor}” <Badge tone="outline">{l.type}</Badge></li>)}</ul>
                </div>}
                {brief.doNot.length > 0 && <div><div className="micro" style={{ marginBottom: 6 }}>Không được</div>
                  <ul className={s.plain}>{brief.doNot.map((d) => <li key={d} className="body-s" style={{ display: "flex", gap: 6 }}><span style={{ color: "var(--danger)" }}>✕</span>{d}</li>)}</ul>
                </div>}
              </div>
            </details>
          )}

          <details className={s.details}>
            <summary><span>JSON-LD</span><span className={s.sum}>{jsonLd ? "sinh từ bài + hồ sơ dự án" : "chưa có"}</span></summary>
            <div className={s.detailsBody}>
              {jsonLd ? (
                <>
                  <div><Button size="s" variant="secondary" onClick={copyJsonLd} iconLeft={copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />} aria-live="polite">{copied ? "Đã copy" : "Copy"}</Button></div>
                  <pre className={["mono", s.code].join(" ")}>{prettyJson(jsonLd)}</pre>
                </>
              ) : <p className="caption">JSON-LD được sinh tự động sau khi Claude viết xong bài.</p>}
            </div>
          </details>

          <Panel title="Phiên bản" sub={`${revisions.length}`} flush>
            {revisions.length === 0 ? <p className="caption" style={{ padding: "12px var(--cms-panel-pad-x)" }}>Mỗi lần Writer chạy hoặc bạn lưu kèm ghi chú sẽ tạo một phiên bản.</p> : (
              <ul>
                {revisions.map((r) => (
                  <li key={r.id} className={s.revRow}>
                    <span style={{ flex: "1 1 auto", minWidth: 0 }}>
                      <span style={{ display: "block", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.note || "Phiên bản"}</span>
                      <span className="caption mono">{new Date(r.createdAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })} · {wordCount(r.bodyMarkdown)} từ</span>
                    </span>
                    <Button size="s" variant="ghost" iconLeft={<RotateCcw size={13} aria-hidden />} onClick={() => restore(r)} disabled={streaming || restoring}>Khôi phục</Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <form action={deleteArticle} onSubmit={(e) => { if (!window.confirm("Xoá bài viết này cùng toàn bộ phiên bản và điểm số?")) e.preventDefault(); }} style={{ display: "flex", justifyContent: "flex-end" }}>
            <input type="hidden" name="articleId" value={article.id} />
            <Button type="submit" size="s" variant="ghost" className={s.dangerGhost} iconLeft={<Trash2 size={13} aria-hidden />} disabled={streaming}>Xoá bài</Button>
          </form>
        </aside>
      </div>
    </div>
  );
}
