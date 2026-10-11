"use client";

import { ArrowDown, Check, Copy, Download, Ellipsis, Gauge, Keyboard, PenLine, RotateCcw, Save, Square, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { deleteArticle, restoreRevision, saveArticle, setArticleStatus } from "@/app/article-actions";
import { Badge, Button, SystemNotice, useToast } from "@/components/ui";
import { extractHeadings, renderMarkdown, wordCount } from "@/lib/markdown";
import type { ContentBrief, ScoreCriterion, WriterMode } from "@/lib/schemas";
import s from "./ArticleEditor.module.css";
import { fmtElapsed, isTypingTarget, useAutoGrow, useDismiss, useElapsed, useWide } from "./hooks";
import { Menu } from "./Menu";
import { ScorePanel, type ScoreView } from "./ScorePanel";
import { Section } from "./Section";
import { STATUS_LABEL } from "./status";
import { useWriterStream } from "./useWriterStream";

export type { ScoreView };
export type ArticleData = { id: string; projectId: string; briefId: string | null; targetKeyword: string; title: string; slug: string; metaDescription: string; bodyMarkdown: string; jsonLd: string | null; status: string; model: string; updatedAt: string };
export type RevisionData = { id: string; note: string; bodyMarkdown: string; createdAt: string };
type Props = { article: ArticleData; brief: ContentBrief | null; revisions: RevisionData[]; initialScore: ScoreView | null; canGenerate: boolean; autostart: boolean };

type Tab = "edit" | "preview" | "split";
type Fields = { title: string; slug: string; metaDescription: string; bodyMarkdown: string };
const META_MAX = 155;
const WPM = 220; // tốc độ đọc tiếng Việt ước lượng
const MODE_LABEL: Record<WriterMode, string> = { write: "Claude đang viết", fix: "Claude đang sửa", rewrite: "Claude đang viết lại" };
const STATUS_TEXT: Record<string, string> = { draft: "Nháp", review: "Chờ duyệt", final: "Hoàn tất", writing: "Đang viết" };
const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const nf = new Intl.NumberFormat("vi-VN");

function prettyJson(raw: string | null): string {
  if (!raw) return "";
  try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
}
const timeOf = (d: Date) => d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

/** Phần tử có tự cuộn bên trong không (≥900px các khung cuộn riêng; điện thoại cuộn cả trang). */
function scrollsInside(el: HTMLElement | null): boolean {
  if (!el) return false;
  const oy = getComputedStyle(el).overflowY;
  return oy === "auto" || oy === "scroll";
}

/** Đo chiều cao phần tử → CSS var trên `host` (cho các phép tính chiều cao khung). */
function useHeightVar(ref: React.RefObject<HTMLElement | null>, host: React.RefObject<HTMLElement | null>, name: string) {
  useLayoutEffect(() => {
    const el = ref.current, h = host.current;
    if (!el || !h || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => h.style.setProperty(name, `${Math.round(el.getBoundingClientRect().height)}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, host, name]);
}

function WordMeter({ words, min, max }: { words: number; min: number; max: number }) {
  const scale = Math.max(max * 1.3, words, 1);
  const tone = words < min ? "warning" : words <= max ? "success" : words <= max * 1.2 ? "warning" : "danger";
  const hint = words < min ? `thiếu ${nf.format(min - words)}` : words <= max ? "đạt mục tiêu" : `dư ${nf.format(words - max)}`;
  return (
    <div className={s.meter} title={`Mục tiêu brief: ${nf.format(min)}–${nf.format(max)} từ`}>
      <div className={s.meterTrack} role="meter" aria-label="Số từ so với mục tiêu brief" aria-valuemin={0} aria-valuemax={Math.round(scale)} aria-valuenow={words} aria-valuetext={`${words} từ, mục tiêu ${min}–${max}, ${hint}`}>
        <span className={s.meterBand} style={{ left: `${(min / scale) * 100}%`, width: `${((max - min) / scale) * 100}%` }} />
        <span className={[s.meterFill, s[`fill_${tone}`]].join(" ")} style={{ transform: `scaleX(${Math.min(1, words / scale)})` }} />
      </div>
      <span className={["mono", s[tone]].join(" ")}>{nf.format(min)}–{nf.format(max)} · {hint}</span>
    </div>
  );
}

export function ArticleEditor({ article, brief, revisions, initialScore, canGenerate, autostart }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const wide = useWide();
  const [fields, setFields] = useState<Fields>({ title: article.title, slug: article.slug, metaDescription: article.metaDescription, bodyMarkdown: article.bodyMarkdown });
  const [saved, setSaved] = useState<Fields>(fields);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [status, setStatus] = useState(article.status);
  const [jsonLd, setJsonLd] = useState(article.jsonLd);
  const [tab, setTab] = useState<Tab>(article.bodyMarkdown ? "split" : "edit");
  const [score, setScore] = useState<ScoreView | null>(initialScore);
  const [scoring, setScoring] = useState(false);
  const [notice, setNotice] = useState<{ tone: "red" | "amber"; title: string; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [fixing, setFixing] = useState<{ id: string; label: string } | null>(null);
  const [keysOpen, setKeysOpen] = useState(false);
  const [stuck, setStuck] = useState(false);
  const [follow, setFollowState] = useState(true);
  const [saving, startSave] = useTransition();
  const [statusPending, startStatus] = useTransition();
  const [restoring, startRestore] = useTransition();
  const body = fields.bodyMarkdown;
  const dirtyFields = fields.title !== saved.title || fields.slug !== saved.slug || fields.metaDescription !== saved.metaDescription || body !== saved.bodyMarkdown;

  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const metaRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const keysRef = useRef<HTMLDivElement>(null);
  const keysBtnRef = useRef<HTMLButtonElement>(null);
  const fixingRef = useRef(fixing);
  useEffect(() => { fixingRef.current = fixing; }, [fixing]);
  const toastId = `writer-${article.id}`;

  useAutoGrow(titleRef, fields.title);
  useAutoGrow(metaRef, fields.metaDescription);
  useHeightVar(barRef, rootRef, "--ed-bar-h");
  useHeightVar(footRef, rootRef, "--ed-foot-h");

  // props đổi sau router.refresh() (writer lưu jsonLd, revision mới) → đồng bộ phần không do người dùng sửa
  useEffect(() => { setJsonLd(article.jsonLd); }, [article.jsonLd]);
  useEffect(() => { setStatus(article.status); }, [article.status]);
  // Dưới 900px không có "Song song": mặc định "Soạn thảo"
  useEffect(() => { if (!wide && tab === "split") setTab("edit"); }, [wide, tab]);

  const set = (patch: Partial<Fields>) => setFields((f) => ({ ...f, ...patch }));

  /* ───── Lưu ───── */
  const persist = useCallback(async (note?: string): Promise<boolean> => {
    const snapshot = fields;
    const r = await saveArticle(article.id, snapshot, note);
    if (r.ok) { setSaved(snapshot); setSavedAt(new Date()); return true; }
    toast({ id: `save-${article.id}`, tone: "error", title: "Không lưu được", description: r.error });
    return false;
  }, [article.id, fields, toast]);

  /* ───── Streaming ───── */
  const writer = useWriterStream(article.id, {
    onDelta: (mode, text) => { if (mode === "write") setFields((f) => ({ ...f, bodyMarkdown: text })); },
    onDone: (mode, text, words) => {
      setFields((f) => ({ ...f, bodyMarkdown: text }));
      setSaved((sv) => ({ ...sv, bodyMarkdown: text }));
      setSavedAt(new Date());
      setStatus("review");
      setTab((t) => (t === "edit" && wide ? "split" : t));
      const n = nf.format(words || wordCount(text));
      const fx = fixingRef.current;
      toast({ id: toastId, tone: "success", title: mode === "write" ? `Đã viết xong · ${n} từ` : mode === "fix" ? `Đã áp dụng: ${fx?.label ?? "bản sửa"}` : `Đã viết lại · ${n} từ`, description: "Đã lưu và chấm lại bằng rule engine." });
      setFixing(null);
      router.refresh();
      void runScore(false, true, true);
    },
    onError: (_mode, message) => {
      setFixing(null);
      toast({ id: toastId, tone: "error", title: "Writer gặp lỗi", description: message });
      router.refresh();
    },
    // Ngắt kết nối phía client: máy chủ vẫn viết tiếp và tự lưu khi xong → giữ phần đã nhận, không đánh dấu dirty, nhắc tải lại.
    onAbort: (mode, text) => {
      setFixing(null);
      if (mode === "write" && text) { setFields((f) => ({ ...f, bodyMarkdown: text })); setSaved((sv) => ({ ...sv, bodyMarkdown: text })); }
      toast({ id: toastId, tone: "info", title: "Đã dừng nhận nội dung" });
      setNotice({ tone: "amber", title: "Đã ngắt kết nối", text: "Claude vẫn hoàn tất bài trong nền và tự lưu khi xong — tải lại trang sau ít phút để xem bản đầy đủ." });
    },
  });
  const { streaming, mode, incoming } = writer;
  // Trong lúc stream, nội dung về từ server (server tự lưu khi xong) → không tính là "chưa lưu"
  const dirty = dirtyFields && !streaming;
  const elapsed = useElapsed(streaming);

  /* ───── Chấm điểm ───── */
  /** `afterWrite`: gọi từ onDone — server vừa lưu bản mới, không lưu lại (closure có thể cũ). */
  const runScore = useCallback(async (withAi: boolean, quiet = false, afterWrite = false) => {
    setScoring(true);
    try {
      if (!afterWrite && dirty && !(await persist("Lưu trước khi chấm điểm"))) return;
      const res = await fetch(`/api/articles/${article.id}/score`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ withAi }) });
      const j = (await res.json()) as (ScoreView & { error?: string }) | { error: string };
      if (!res.ok || ("error" in j && j.error)) throw new Error(("error" in j && j.error) || `HTTP ${res.status}`);
      const sv = j as ScoreView;
      setScore(sv);
      if (!quiet) toast({ id: `score-${article.id}`, tone: "success", title: `Đã chấm điểm · SEO ${sv.seoScore} · GEO ${sv.geoScore}`, description: withAi ? "Rule engine + Claude" : "Rule engine (không tốn token)" });
      router.refresh();
    } catch (e) {
      toast({ id: `score-${article.id}`, tone: "error", title: "Không chấm điểm được", description: e instanceof Error ? e.message : String(e) });
    } finally { setScoring(false); }
  }, [article.id, router, dirty, persist, toast]);

  const streamingRef = useRef(streaming);
  useEffect(() => { streamingRef.current = streaming; }, [streaming]);

  const save = useCallback(() => {
    if (!dirty || saving || streaming) return;
    startSave(async () => { if (await persist()) toast({ id: `save-${article.id}`, tone: "success", title: "Đã lưu" }); });
  }, [dirty, saving, streaming, persist, toast, article.id]);

  const startWriter = (m: WriterMode, instruction?: string) => {
    setStatus("writing");
    toast({ id: toastId, tone: "progress", title: `${MODE_LABEL[m]}…`, description: "Nội dung stream trực tiếp vào trình soạn thảo." });
    void writer.start(m, instruction);
  };

  const begin = async (m: WriterMode, instruction?: string, crit?: ScoreCriterion) => {
    if (!canGenerate || streaming) return;
    if (m === "write" && body.trim() && !window.confirm("Viết lại từ đầu sẽ thay toàn bộ nội dung hiện tại (bản cũ được giữ trong Phiên bản). Tiếp tục?")) return;
    if (crit) setFixing({ id: crit.id, label: crit.label });
    if (dirty && !(await persist("Lưu trước khi gọi Writer"))) { setFixing(null); return; }
    setNotice(null);
    if (m !== "write" && tab === "edit") setTab("preview");
    startWriter(m, instruction);
  };

  // autostart sau khi tạo bài: chỉ một lần, bỏ ?autostart khỏi URL để reload không chạy lại
  const autoRef = useRef(false);
  useEffect(() => {
    if (autoRef.current) return;
    autoRef.current = true;
    if (autostart) {
      try { window.history.replaceState(null, "", window.location.pathname); } catch { /* ignore */ }
      if (article.bodyMarkdown === "" && canGenerate) startWriter("write");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ───── Phím tắt ───── */
  const canScore = !streaming && !scoring && body.trim().length > 0;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
      else if (mod && e.key === "Enter") { e.preventDefault(); if (canScore) void runScore(false); }
      else if (e.key === "?" && !mod && !isTypingTarget(e.target)) { e.preventDefault(); setKeysOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, runScore, canScore]);
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  useDismiss(keysOpen, [keysRef, keysBtnRef], () => setKeysOpen(false));
  useEffect(() => { if (keysOpen) keysRef.current?.focus({ preventScroll: true }); }, [keysOpen]);

  /* ───── Toolbar dính: viền/bóng chỉ khi đã dính ───── */
  useEffect(() => {
    let raf = 0;
    const check = () => {
      raf = 0;
      const bar = barRef.current, sen = sentinelRef.current;
      if (!bar || !sen) return;
      const top = parseFloat(getComputedStyle(bar).top) || 0;
      setStuck(sen.getBoundingClientRect().top < top - 0.5);
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(check); };
    check();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, []);

  /* ───── Stick-to-bottom khi stream ───── */
  const followRef = useRef(true);
  const setFollow = useCallback((v: boolean) => { if (followRef.current !== v) { followRef.current = v; setFollowState(v); } }, []);
  const panes = useCallback((): HTMLElement[] => [editorRef.current, previewRef.current].filter((x): x is HTMLTextAreaElement | HTMLDivElement => Boolean(x)), []);
  const bottomGap = () => (wide ? 16 : 88); // chừa thanh hành động dưới đáy trên điện thoại
  const scrollToEnd = useCallback(() => {
    const ps = panes();
    let pageEl: HTMLElement | null = null;
    for (const p of ps) { if (scrollsInside(p)) p.scrollTop = p.scrollHeight; else pageEl = p; }
    if (pageEl) {
      const r = pageEl.getBoundingClientRect();
      const delta = r.bottom - (window.innerHeight - bottomGap());
      if (delta > 0) window.scrollBy({ top: delta, behavior: "instant" as ScrollBehavior });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panes, wide]);

  useEffect(() => {
    if (!streaming) return;
    setFollow(true);
    const last = new Map<EventTarget, number>();
    const onScroll = (e: Event) => {
      const t = e.currentTarget as HTMLElement | Window;
      const isWin = t === window;
      const el = isWin ? document.scrollingElement as HTMLElement : (t as HTMLElement);
      if (!isWin && !scrollsInside(el)) return;
      const top = el.scrollTop, prev = last.get(t) ?? top;
      last.set(t, top);
      let dist: number;
      if (isWin) {
        const tail = panes().filter((p) => !scrollsInside(p)).pop();
        if (!tail) return;
        dist = tail.getBoundingClientRect().bottom - (window.innerHeight - bottomGap());
      } else dist = el.scrollHeight - el.clientHeight - top;
      if (top < prev - 2 && dist > 48) setFollow(false);
      else if (dist < 24) setFollow(true);
    };
    // Ý định cuộn lên đến từ thiết bị nhập (bắt đồng bộ, trước khi lần tự cuộn kế tiếp kéo xuống lại)
    const inPanes = (t: EventTarget | null) => panes().some((p) => p.contains(t as Node));
    const relevant = (t: EventTarget | null) => !wide || inPanes(t);
    const onWheel = (e: WheelEvent) => { if (e.deltaY < 0 && relevant(e.target)) setFollow(false); };
    let ty = 0;
    const onTouchStart = (e: TouchEvent) => { ty = e.touches[0]?.clientY ?? 0; };
    const onTouchMove = (e: TouchEvent) => { const y = e.touches[0]?.clientY ?? 0; if (y - ty > 6 && relevant(e.target)) setFollow(false); ty = y; };
    const onKey = (e: KeyboardEvent) => { if ((e.key === "PageUp" || e.key === "Home" || (e.key === "ArrowUp" && !isTypingTarget(e.target))) && relevant(e.target)) setFollow(false); };
    const targets: (HTMLElement | Window)[] = [window, ...panes()];
    targets.forEach((t) => t.addEventListener("scroll", onScroll, { passive: true }));
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      targets.forEach((t) => t.removeEventListener("scroll", onScroll));
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streaming, tab, wide, panes, setFollow]);

  // Chỉ cuộn khi đã có chữ về (render đầu tiên của stream vẫn còn nội dung cũ)
  useLayoutEffect(() => { if (streaming && incoming && followRef.current) scrollToEnd(); }, [incoming, streaming, scrollToEnd]);

  /* ───── Đồng bộ cuộn Song song (theo tỷ lệ, chống vòng lặp) ───── */
  useEffect(() => {
    if (tab !== "split" || !wide) return;
    const a = editorRef.current, b = previewRef.current;
    if (!a || !b) return;
    let lock: HTMLElement | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const link = (src: HTMLElement, dst: HTMLElement) => () => {
      if (streamingRef.current && followRef.current) return;
      if (lock && lock !== src) return; // tiếng vọng từ lần đồng bộ trước
      lock = src;
      clearTimeout(timer);
      timer = setTimeout(() => { lock = null; }, 120);
      const max = src.scrollHeight - src.clientHeight;
      const ratio = max > 0 ? src.scrollTop / max : 0;
      dst.scrollTop = ratio * (dst.scrollHeight - dst.clientHeight);
    };
    const fa = link(a, b), fb = link(b, a);
    a.addEventListener("scroll", fa, { passive: true });
    b.addEventListener("scroll", fb, { passive: true });
    return () => { a.removeEventListener("scroll", fa); b.removeEventListener("scroll", fb); clearTimeout(timer); };
  }, [tab, wide]);

  const changeStatus = (next: string) => {
    const prev = status; setStatus(next);
    startStatus(async () => {
      const r = await setArticleStatus(article.id, next as "draft" | "review" | "final");
      if (!r.ok) { setStatus(prev); toast({ tone: "error", title: "Không đổi được trạng thái", description: "Thử lại sau." }); }
      else { toast({ id: `status-${article.id}`, tone: "success", title: `Trạng thái: ${STATUS_TEXT[next] ?? next}` }); router.refresh(); }
    });
  };

  const restore = (rev: RevisionData) => {
    if (!window.confirm(`Khôi phục phiên bản ${new Date(rev.createdAt).toLocaleString("vi-VN")}? Nội dung hiện tại sẽ được lưu thành một phiên bản mới.`)) return;
    startRestore(async () => {
      const r = await restoreRevision(article.id, rev.id);
      if (r.ok) {
        setFields((f) => ({ ...f, bodyMarkdown: rev.bodyMarkdown })); setSaved((sv) => ({ ...sv, bodyMarkdown: rev.bodyMarkdown })); setSavedAt(new Date());
        toast({ tone: "success", title: "Đã khôi phục phiên bản", description: `${rev.note || "Phiên bản"} · ${nf.format(wordCount(rev.bodyMarkdown))} từ` });
        router.refresh();
      } else toast({ tone: "error", title: "Không khôi phục được", description: r.error });
    });
  };

  const copyJsonLd = async () => {
    try { await navigator.clipboard.writeText(prettyJson(jsonLd)); setCopied(true); toast({ tone: "success", title: "Đã copy JSON-LD" }); setTimeout(() => setCopied(false), 1800); }
    catch { toast({ tone: "error", title: "Không copy được", description: "Trình duyệt chặn clipboard — chọn và copy thủ công." }); }
  };

  /* ───── Dẫn xuất ───── */
  const previewSource = streaming && mode !== "write" ? incoming : body;
  const html = useMemo(() => renderMarkdown(previewSource), [previewSource]);
  const words = useMemo(() => wordCount(body), [body]);
  const headings = useMemo(() => extractHeadings(body).length, [body]);
  const incomingWords = useMemo(() => (streaming ? wordCount(incoming) : 0), [streaming, incoming]);
  const metaLen = fields.metaDescription.length;
  const exportBase = `/api/articles/${article.id}/export`;
  const st = STATUS_LABEL[status] ?? { label: status, tone: "outline" as const };
  const writePrimary = body.trim() === "" && !dirty && !streaming;
  const showPreview = tab !== "edit";
  const showEditor = tab !== "preview";
  const mod = IS_MAC ? "⌘" : "Ctrl";
  const statusState = streaming ? "busy" : saving ? "busy" : dirty ? "dirty" : "ok";
  const statusText = streaming && mode ? (wide ? `${MODE_LABEL[mode]}… ${nf.format(incomingWords)} từ · ${fmtElapsed(elapsed)}` : `${nf.format(incomingWords)} từ · ${fmtElapsed(elapsed)}`) : saving ? "Đang lưu…" : dirty ? "Chưa lưu" : savedAt ? `Đã lưu ${timeOf(savedAt)}` : "Đã lưu";

  const liveText = streaming && mode ? `${MODE_LABEL[mode]}…` : saving ? "Đang lưu…" : dirty ? "Chưa lưu thay đổi" : "Tất cả đã lưu";

  const saveBtn = (cls?: string) => <Button className={cls} variant={dirty ? "primary" : "secondary"} iconLeft={<Save size={16} aria-hidden />} onClick={save} loading={saving} disabled={!dirty || streaming} title={`${mod} + S`}>Lưu</Button>;
  const writeBtn = (cls?: string) => streaming
    ? <Button className={cls} variant="secondary" iconLeft={<Square size={14} aria-hidden />} onClick={writer.cancel}>Dừng</Button>
    : <Button className={cls} variant={writePrimary ? "primary" : "secondary"} iconLeft={<PenLine size={16} aria-hidden />} onClick={() => begin("write")} disabled={!canGenerate || saving} title={canGenerate ? (body ? "Viết lại toàn bộ bài từ brief" : "Claude viết bài theo brief, stream trực tiếp") : "Chưa có ANTHROPIC_API_KEY"}>Viết bài</Button>;
  const scoreBtn = (cls?: string) => <Button className={cls} variant="secondary" iconLeft={<Gauge size={16} aria-hidden />} onClick={() => runScore(canGenerate)} loading={scoring} disabled={streaming || !body.trim()} title={canGenerate ? `Rule engine + Claude chấm GEO · ${mod} + Enter: chỉ rule` : `Chấm bằng rule engine · ${mod} + Enter`}>Chấm điểm</Button>;

  const shortcuts: [string, string][] = [[`${mod} S`, "Lưu"], [`${mod} Enter`, "Chấm điểm (rule, không tốn token)"], ["Esc", "Đóng menu"], ["?", "Mở / đóng bảng này"]];

  return (
    <div ref={rootRef} className={["stack", s.root].join(" ")}>
      {/* ───── Header ───── */}
      <div className={s.head}>
        <div className={s.kicker}>
          <span className="micro">Bài viết · {article.model}</span>
          <Badge tone={st.tone}>{st.label}</Badge>
          {brief && article.briefId && <Link href={`/projects/${article.projectId}/briefs/${article.briefId}`} className={s.inlineLink}>Xem brief</Link>}
        </div>
        <textarea
          ref={titleRef} rows={1} className={["h1", s.titleInput].join(" ")} value={fields.title}
          onChange={(e) => set({ title: e.target.value.replace(/\s*\n+\s*/g, " ") })}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
          aria-label="Tiêu đề bài viết" placeholder="Tiêu đề bài viết" spellCheck={false}
        />
        <div className="caption mono">từ khoá: {article.targetKeyword}</div>
      </div>

      <div className={s.metaGrid}>
        <div className={[s.field, s.slugField].join(" ")}>
          <label htmlFor="a-slug">Slug</label>
          <div className={s.slugWrap}><span className={s.slugPrefix} aria-hidden>/</span><input id="a-slug" className={s.slugInput} value={fields.slug} onChange={(e) => set({ slug: e.target.value })} spellCheck={false} autoComplete="off" /></div>
        </div>
        <div className={[s.field, s.statusField].join(" ")}>
          <label htmlFor="a-status">Trạng thái</label>
          <select id="a-status" className={s.select} value={status} onChange={(e) => changeStatus(e.target.value)} disabled={streaming || statusPending}>
            <option value="draft">Nháp</option>
            {status === "writing" && <option value="writing" disabled>Đang viết</option>}
            <option value="review">Chờ duyệt</option>
            <option value="final">Hoàn tất</option>
          </select>
        </div>
        <div className={[s.field, s.metaField].join(" ")}>
          <label htmlFor="a-meta"><span>Meta description</span><span className={["mono", s.counter, metaLen > META_MAX ? s.over : ""].join(" ")} aria-live="polite">{metaLen}/{META_MAX}</span></label>
          <textarea ref={metaRef} id="a-meta" className={[s.metaInput, metaLen > META_MAX ? s.metaOver : ""].join(" ")} value={fields.metaDescription} onChange={(e) => set({ metaDescription: e.target.value.replace(/\n+/g, " ") })} rows={1} placeholder="≤ 155 ký tự, chứa từ khoá, có lời kêu gọi hành động" aria-invalid={metaLen > META_MAX || undefined} />
        </div>
      </div>

      {notice && <SystemNotice tone={notice.tone} title={notice.title} action={<span className="row" style={{ gap: 10, flexWrap: "nowrap" }}>{notice.tone === "amber" && <button type="button" className={s.linkBtn} onClick={() => { setNotice(null); router.refresh(); }}>Tải lại</button>}<button type="button" className={s.linkBtn} onClick={() => setNotice(null)}>Đóng</button></span>}>{notice.text}</SystemNotice>}
      {!canGenerate && <SystemNotice tone="amber">Chưa có ANTHROPIC_API_KEY — vẫn soạn thảo, lưu và chấm bằng rule engine, nhưng Claude không viết hay sửa bài.</SystemNotice>}

      {/* ───── Toolbar dính ───── */}
      <div className={s.workspace}>
        <div ref={sentinelRef} className={s.sentinel} aria-hidden />
        <div ref={barRef} className={[s.toolbar, stuck ? s.stuck : ""].join(" ")} data-stuck={stuck || undefined}>
          <div className={s.tabs} role="tablist" aria-label="Chế độ soạn thảo">
            {([["edit", "Soạn thảo"], ["preview", "Xem trước"], ["split", "Song song"]] as const).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} className={[s.tab, tab === k ? s.tabActive : "", k === "split" ? s.tabSplit : ""].join(" ")} onClick={() => setTab(k)}>{label}</button>
            ))}
          </div>
          <span className="sr-only" role="status">{liveText}</span>
          <span className={[s.status, s[`st_${statusState}`]].join(" ")} title={statusText} aria-hidden>
            <span className={s.statusDot} aria-hidden />
            <span className={s.statusText}>{statusText}</span>
          </span>
          <span className={s.spacer} />
          <div className={s.barActions}>{saveBtn()}{writeBtn()}{scoreBtn()}</div>
          <Menu label={<span className={s.menuLabel}>Xuất</span>} icon={<><Download size={15} aria-hidden className={s.iconWide} /><Ellipsis size={18} aria-hidden className={s.iconNarrow} /></>} title="Xuất & phím tắt">
            {(close) => (
              <>
                <div className={s.menuHead}>Tải xuống</div>
                <a role="menuitem" className={s.menuItem} href={`${exportBase}?format=md&download=1`} onClick={close}><Download size={14} aria-hidden />Markdown <span className={s.menuHint}>.md</span></a>
                <a role="menuitem" className={s.menuItem} href={`${exportBase}?format=html&download=1`} onClick={close}><Download size={14} aria-hidden />HTML <span className={s.menuHint}>.html</span></a>
                <a role="menuitem" className={s.menuItem} href={`${exportBase}?format=jsonld&download=1`} onClick={close}><Download size={14} aria-hidden />JSON-LD <span className={s.menuHint}>.json</span></a>
                <div className={s.menuSep} />
                <button role="menuitem" type="button" className={s.menuItem} onClick={() => { close(); setKeysOpen(true); }}><Keyboard size={14} aria-hidden />Phím tắt <span className={s.menuHint}>?</span></button>
              </>
            )}
          </Menu>
          {streaming && <div className={s.barProgress} role="progressbar" aria-label={statusText} />}
          {keysOpen && (
            <div ref={keysRef} id="ed-keys" role="dialog" aria-label="Phím tắt" tabIndex={-1} className={[s.menuPop, s.keysPop].join(" ")}>
              <div className={s.menuHead}>Phím tắt</div>
              <dl className={s.keys}>
                {shortcuts.map(([k, v]) => <div key={k}><dt><kbd>{k}</kbd></dt><dd>{v}</dd></div>)}
              </dl>
            </div>
          )}
        </div>

        <div className={s.layout}>
          {/* ───── Cột chính ───── */}
          <div className={s.main}>
            <div className={[s.panes, tab === "split" ? s.split : "", showPreview && !showEditor ? s.previewOnly : ""].join(" ")}>
              {showEditor && (
                <textarea ref={editorRef} className={s.editor} value={body} onChange={(e) => set({ bodyMarkdown: e.target.value })} readOnly={streaming} aria-label="Nội dung Markdown" aria-busy={streaming || undefined} placeholder={canGenerate ? "Bấm “Viết bài” để Claude soạn theo brief, hoặc gõ Markdown tại đây…" : "Gõ Markdown tại đây…"} spellCheck={false} />
              )}
              {showPreview && (
                <div ref={previewRef} className={s.previewPane} aria-live={streaming ? "off" : undefined} aria-busy={streaming || undefined} aria-label="Xem trước" tabIndex={0}>
                  {streaming && mode !== "write" && <div className={s.incomingTag}><Badge tone="info">bản sửa đang về</Badge><span className="caption">Sẽ thay vào trình soạn thảo khi hoàn tất.</span></div>}
                  {previewSource.trim() ? <article className={[s.prose, streaming ? s.streamingProse : ""].join(" ")} dangerouslySetInnerHTML={{ __html: html }} /> : <p className="caption">{streaming ? <span className={s.caretOnly} aria-hidden /> : "Chưa có nội dung để xem trước."}</p>}
                </div>
              )}
            </div>
            <div className={s.pillDock}>
              {streaming && !follow && (
                <button type="button" className={s.followPill} onClick={() => { setFollow(true); scrollToEnd(); }}><ArrowDown size={14} aria-hidden />Theo dõi</button>
              )}
            </div>

            <div ref={footRef} className={s.footer}>
              <span className={["mono", s.stats].join(" ")}>{nf.format(words)} từ · {nf.format(body.length)} ký tự · {headings} heading · ~{Math.max(1, Math.round(words / WPM))} phút đọc</span>
              {brief && <WordMeter words={words} min={brief.wordCountMin} max={brief.wordCountMax} />}
              <span className={s.spacer} />
              <button ref={keysBtnRef} type="button" className={s.keysBtn} onClick={() => setKeysOpen((o) => !o)} aria-expanded={keysOpen} aria-controls="ed-keys" title="Phím tắt (?)">
                <Keyboard size={14} aria-hidden /><span>Phím tắt</span><kbd>?</kbd>
              </button>
            </div>
          </div>

          {/* ───── Aside ───── */}
          <aside className={s.aside} aria-label="Điểm, brief và phiên bản">
            <ScorePanel score={score} scoring={scoring} streaming={streaming} canGenerate={canGenerate} fixingId={fixing?.id ?? null} onScore={(withAi) => void runScore(withAi)} onFix={(c) => void begin("fix", c.fix, c)} />

            {brief && (
              <Section title="Brief" sub={`${brief.outline.length} mục · ${nf.format(brief.wordCountMin)}–${nf.format(brief.wordCountMax)} từ`}>
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
              </Section>
            )}

            <Section title="JSON-LD" sub={jsonLd ? "sinh từ bài + hồ sơ dự án" : "chưa có"}>
              {jsonLd ? (
                <>
                  <div><Button size="s" variant="secondary" className={s.tap} onClick={copyJsonLd} iconLeft={copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}>{copied ? "Đã copy" : "Copy"}</Button></div>
                  <pre className={["mono", s.code].join(" ")}>{prettyJson(jsonLd)}</pre>
                </>
              ) : <p className="caption">JSON-LD được sinh tự động sau khi Claude viết xong bài.</p>}
            </Section>

            <Section title="Phiên bản" sub={`${revisions.length}`} defaultOpen="wide" flush>
              {revisions.length === 0 ? <p className="caption" style={{ padding: "12px var(--cms-panel-pad-x)" }}>Mỗi lần Writer chạy hoặc bạn lưu kèm ghi chú sẽ tạo một phiên bản.</p> : (
                <ul>
                  {revisions.map((r) => (
                    <li key={r.id} className={s.revRow}>
                      <span style={{ flex: "1 1 auto", minWidth: 0 }}>
                        <span className={s.revNote}>{r.note || "Phiên bản"}</span>
                        <span className="caption mono">{new Date(r.createdAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })} · {nf.format(wordCount(r.bodyMarkdown))} từ</span>
                      </span>
                      <Button size="s" variant="ghost" className={s.tap} iconLeft={<RotateCcw size={13} aria-hidden />} onClick={() => restore(r)} disabled={streaming || restoring}>Khôi phục</Button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <form action={deleteArticle} onSubmit={(e) => { if (!window.confirm("Xoá bài viết này cùng toàn bộ phiên bản và điểm số?")) e.preventDefault(); }} className={s.deleteRow}>
              <input type="hidden" name="articleId" value={article.id} />
              <span className="caption">Cập nhật {new Date(article.updatedAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</span>
              <Button type="submit" size="s" variant="ghost" className={[s.dangerGhost, s.tap].join(" ")} iconLeft={<Trash2 size={13} aria-hidden />} disabled={streaming}>Xoá bài</Button>
            </form>
          </aside>
        </div>
      </div>

      {/* ───── Thanh hành động dưới đáy (điện thoại) ───── */}
      <div className={s.bottomBar} data-bottom-bar role="toolbar" aria-label="Hành động bài viết">
        {saveBtn(s.bottomBtn)}{writeBtn(s.bottomBtn)}{scoreBtn(s.bottomBtn)}
      </div>
    </div>
  );
}
