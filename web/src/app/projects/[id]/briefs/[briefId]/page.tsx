import { CircleCheck, Download, ExternalLink, Link2, X } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Panel, SystemNotice, type BadgeTone } from "@/components/ui";
import { ClampText } from "@/components/content/ClampText";
import { CopyText } from "@/components/content/CopyText";
import { DetailLayout } from "@/components/content/DetailLayout";
import { KpiTile } from "@/components/content/KpiTile";
import { RichText } from "@/components/content/RichText";
import { TimeAgo } from "@/components/content/time";
import c from "@/components/content/content.module.css";
import { hasApiKey } from "@/lib/claude";
import { prisma } from "@/lib/db";
import { ContentBrief } from "@/lib/schemas";
import { INTENT_LABEL, IntentBadge } from "../../IntentBadge";
import { ProjectHeader } from "../../ProjectHeader";
import { ArticleForm } from "../../articles/ArticleForm";
import { CopyButton } from "./CopyButton";

export const dynamic = "force-dynamic";

const PRIORITY: Record<string, { label: string; tone: BadgeTone; rank: number }> = {
  must: { label: "Bắt buộc", tone: "danger", rank: 0 },
  should: { label: "Nên có", tone: "warning", rank: 1 },
  nice: { label: "Tốt nếu có", tone: "neutral", rank: 2 },
};
const MULTI_LABEL: Record<string, string> = { image: "Ảnh", infographic: "Infographic", table: "Bảng", video: "Video", pdf: "PDF", calculator: "Công cụ tính", checklist: "Checklist" };

/** "Type: phần còn lại" → [type, rest]; type chỉ nhận khi ngắn (tránh nhét câu dài vào nhãn). */
function splitType(x: string): [string | null, string] {
  const i = x.indexOf(":");
  return i > 0 && i <= 32 ? [x.slice(0, i).trim(), x.slice(i + 1).trim()] : [null, x.trim()];
}
/** "trường — lý do" */
function splitWhy(x: string): [string, string | null] {
  const i = x.indexOf(" — ");
  return i > 0 ? [x.slice(0, i).trim(), x.slice(i + 3).trim()] : [x, null];
}
const URL_RE = /https?:\/\/[^\s)]+/;

export default async function BriefPage({ params }: { params: Promise<{ id: string; briefId: string }> }) {
  const { id, briefId } = await params;
  const b = await prisma.brief.findUnique({ where: { id: briefId }, include: { cluster: { select: { id: true, title: true } }, project: { select: { name: true } } } });
  if (!b || b.projectId !== id) notFound();
  const parsed = ContentBrief.safeParse(JSON.parse(b.data));
  if (!parsed.success) return <div className="container stack page-in"><SystemNotice tone="red" title="Brief không đúng schema">{parsed.error.issues[0]?.message}</SystemNotice></div>;
  const r = parsed.data;
  const canRun = hasApiKey();
  const mdUrl = `/api/briefs/${b.id}/markdown`;
  const outlineWords = r.outline.reduce((s, o) => s + (o.wordCount || 0), 0);
  const h2Count = r.outline.filter((o) => o.level === 2).length;
  const checklist = [...r.geoChecklist].sort((x, y) => (PRIORITY[x.priority]?.rank ?? 9) - (PRIORITY[y.priority]?.rank ?? 9));
  const outlineMd = r.outline.map((o) => `${"#".repeat(o.level)} ${o.heading}${o.answerFirst ? `\n\n${o.answerFirst}` : ""}`).join("\n\n");
  const linkGroups = ([["internal", "Nội bộ"], ["external", "Bên ngoài"]] as const).map(([t, label]) => ({ t, label, items: r.links.filter((l) => l.type === t) })).filter((g) => g.items.length);

  const toc = [
    { id: "tong-quan", label: "Tổng quan" },
    { id: "outline", label: "Outline" },
    { id: "eeat", label: "E-E-A-T" },
    { id: "geo", label: "Checklist GEO" },
    { id: "schema", label: "Schema" },
    { id: "multi-format", label: "Multi-format" },
    { id: "lien-ket", label: "Liên kết" },
    { id: "faq", label: "FAQ" },
    { id: "luu-y", label: "Lưu ý" },
  ];

  return (
    <div className="container stack page-in">
      <ProjectHeader projectId={id} active="briefs" trail={r.title} />

      <header className={c.head}>
        <div className={c.headText}>
          <div className="micro">
            Content Brief · <TimeAgo date={b.createdAt} />
            {b.cluster && <> · cluster <Link href={`/projects/${id}/clusters/${b.cluster.id}`} style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>{b.cluster.title}</Link></>}
          </div>
          <h1 className="h1">{r.title}</h1>
          <div className={c.headMeta}>
            <IntentBadge intent={r.intent} />
            <Badge tone="outline">{r.wordCountMin.toLocaleString("vi-VN")}–{r.wordCountMax.toLocaleString("vi-VN")} từ</Badge>
            <span className="caption mono" style={{ overflowWrap: "anywhere" }}>/{r.slug}</span>
          </div>
        </div>
        <div className={c.headActions}>
          <span className={c.hideWide}><ArticleForm projectId={id} briefs={[]} defaultBriefId={b.id} disabled={!canRun} compact /></span>
          <CopyButton url={mdUrl} />
          <a href={`${mdUrl}?download=1`} className={c.dlLink}><Download size={14} aria-hidden /> Tải Markdown</a>
        </div>
      </header>

      <DetailLayout
        toc={toc}
        aside={
          <>
            <div className={c.asideTitle}>Bước tiếp theo</div>
            <p className={c.asideText}>Viết bài từ brief này rồi mở trình soạn thảo, chấm SEO/GEO.</p>
            <ArticleForm projectId={id} briefs={[]} defaultBriefId={b.id} disabled={!canRun} compact />
          </>
        }
      >
        <section id="tong-quan" aria-label="Tổng quan" className={c.stackGap}>
          <div className={`${c.kpis} stagger`}>
            <KpiTile label="Từ khoá mục tiêu" value={<span style={{ font: "var(--text-h3)" }}>{r.targetKeyword}</span>} />
            <KpiTile label="Độ dài" value={<><span className={c.num}>{r.wordCountMin.toLocaleString("vi-VN")}–{r.wordCountMax.toLocaleString("vi-VN")}</span><small>từ</small></>} foot={outlineWords ? `outline ~${outlineWords.toLocaleString("vi-VN")} từ` : undefined} />
            <KpiTile label="Ý định" value={INTENT_LABEL[r.intent]?.label ?? r.intent} />
            <KpiTile label="Số mục outline" value={<><span className={c.num}>{r.outline.length}</span><small>mục</small></>} foot={`${h2Count} H2 · ${r.faq.length} FAQ`} />
          </div>
          <Panel title="Góc viết & định dạng" className="reveal">
            <dl className={c.dl}>
              <div><dt>Góc viết</dt><dd><ClampText text={r.angle}><RichText text={r.angle} className={c.lead} /></ClampText></dd></div>
              <div><dt>Định dạng</dt><dd><ClampText text={r.format}><RichText text={r.format} /></ClampText></dd></div>
              <div><dt>Đối tượng</dt><dd><ClampText text={r.audience}><RichText text={r.audience} /></ClampText></dd></div>
              <div><dt>Giọng văn</dt><dd><RichText text={r.tone} /></dd></div>
              <div><dt>Cập nhật</dt><dd className="secondary"><ClampText text={r.updateCadence}><RichText text={r.updateCadence} /></ClampText></dd></div>
              <div>
                <dt>Meta description<span className={c.dtAside}><span className={c.charCount} data-over={r.metaDescription.length > 155 ? "" : undefined}>{r.metaDescription.length}/155 ký tự</span></span></dt>
                <dd className={c.copyRow}><span className="body-s">{r.metaDescription}</span><CopyText text={r.metaDescription} label="Sao chép meta description" toastTitle="Đã copy meta description" /></dd>
              </div>
            </dl>
          </Panel>
        </section>

        <Panel id="outline" title="Outline" sub={`${r.outline.length} mục · answer-first`} className="reveal"
          action={<CopyText text={outlineMd} label="Sao chép outline (Markdown)" toastTitle="Đã copy outline" />}>
          <ol className={c.timeline}>
            {r.outline.map((o, i) => (
              <li key={i} className={c.node} data-level={o.level}>
                <div className={c.nodeHead}>
                  <span className={c.level}>H{o.level}</span>
                  <span className={c.heading}>{o.heading}</span>
                  {o.wordCount > 0 && <span className={c.words}>~{o.wordCount} từ</span>}
                </div>
                {(o.answerFirst !== "" || o.notes !== "" || o.keywords.length > 0) && (
                  <div className={c.nodeBody}>
                    {o.answerFirst !== "" && <div className={c.answer}><span className={c.answerLabel}>Answer-first</span>{o.answerFirst}</div>}
                    {o.notes !== "" && <ClampText text={o.notes} lines={2} threshold={160}><RichText text={o.notes} className={c.notes} /></ClampText>}
                    {o.keywords.length > 0 && <div className={c.kwRow}>{o.keywords.map((k) => <span key={k} className={c.kw} title={k}>{k}</span>)}</div>}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </Panel>

        <div className={`${c.pair} reveal`}>
          <Panel id="eeat" title="E-E-A-T">
            <dl className={`${c.dl} ${c.dlStacked}`}>
              <div><dt>Tác giả</dt><dd className="body-s"><ClampText text={r.eeatAuthor} lines={4}><RichText text={r.eeatAuthor} /></ClampText></dd></div>
              <div><dt>Tín hiệu kinh nghiệm · {r.eeatExperienceSignals.length}</dt><dd><ul className={c.bullets}>{r.eeatExperienceSignals.map((x) => <li key={x}>{x}</li>)}</ul></dd></div>
              <div><dt>Bằng chứng cần có · {r.eeatEvidenceNeeded.length}</dt><dd><ul className={c.bullets}>{r.eeatEvidenceNeeded.map((x) => <li key={x}>{x}</li>)}</ul></dd></div>
              {r.eeatSources.length > 0 && (
                <div>
                  <dt>Nguồn nên dẫn · {r.eeatSources.length}</dt>
                  <dd>
                    <ul className={c.plan}>
                      {r.eeatSources.map((x, i) => {
                        const url = URL_RE.exec(x)?.[0] ?? null;
                        const text = (url ? x.replace(`(${url})`, "").replace(url, "") : x).trim();
                        const [name, why] = splitWhy(text);
                        return (
                          <li key={i} className={c.source}>
                            <span style={{ fontWeight: 500 }}>{url ? <a href={url} target="_blank" rel="noreferrer noopener">{name} <ExternalLink size={12} aria-hidden style={{ verticalAlign: "-1px" }} /></a> : name}</span>
                            {why && <span className={c.planWhy}>{why}</span>}
                          </li>
                        );
                      })}
                    </ul>
                  </dd>
                </div>
              )}
            </dl>
          </Panel>
          <Panel id="geo" title="Checklist GEO" sub={`${r.geoChecklist.length}`}>
            <ul className={c.check}>
              {checklist.map((x) => (
                <li key={x.id}>
                  <CircleCheck size={16} aria-hidden />
                  <div style={{ minWidth: 0 }}>
                    <div className={c.checkHead}><span>{x.label}</span><Badge tone={PRIORITY[x.priority]?.tone ?? "neutral"}>{PRIORITY[x.priority]?.label ?? x.priority}</Badge></div>
                    <div className={c.checkWhy}>{x.why}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className={`${c.pair} reveal`}>
          <Panel id="schema" title="Schema JSON-LD" sub={`${r.schemaPlan.length}`} action={<CopyText text={r.schemaPlan.join("\n")} label="Sao chép kế hoạch schema" toastTitle="Đã copy kế hoạch schema" />}>
            <ul className={c.plan}>
              {r.schemaPlan.map((x, i) => {
                const [type, rest] = splitType(x);
                const [fields, why] = splitWhy(rest);
                return (
                  <li key={i}>
                    {type && <span className={c.planType}>{type}</span>}
                    <span className={c.planFields}>{fields}</span>
                    {why && <span className={c.planWhy}>{why}</span>}
                  </li>
                );
              })}
            </ul>
          </Panel>
          <Panel id="multi-format" title="Multi-format" sub={`${r.multiFormat.length}`}>
            <ul className={c.plan}>
              {r.multiFormat.map((x, i) => {
                const [type, rest] = splitType(x);
                const m = /\(alt:\s*([\s\S]*)\)\s*$/.exec(rest);
                const desc = m ? rest.slice(0, m.index).trim() : rest;
                return (
                  <li key={i}>
                    {type && <span className={c.planType}>{MULTI_LABEL[type.toLowerCase()] ?? type}</span>}
                    <span className="body-s" style={{ maxWidth: "var(--measure)" }}>{desc}</span>
                    {m && <span className={c.planAlt}>alt: {m[1]}</span>}
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>

        <Panel id="lien-ket" title="Liên kết" sub={`${r.links.length}`} action={<Link2 size={16} className="muted" aria-hidden />} className="reveal">
          {linkGroups.length === 0 && <p className="caption">Không có đề xuất liên kết.</p>}
          {linkGroups.length > 0 && (
            <div className={c.split}>
              {linkGroups.map((g) => (
                <div key={g.t} style={{ minWidth: 0 }}>
                  <div className={c.groupLabel}>{g.label} · {g.items.length}</div>
                  <ul className={c.plan}>
                    {g.items.map((l, i) => (
                      <li key={i}>
                        <span style={{ fontWeight: 500, overflowWrap: "anywhere" }}>{l.to}</span>
                        <span><span className={c.anchor}>“{l.anchor}”</span></span>
                        {l.why && <span className={c.planWhy}>{l.why}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <div className={`${c.pair} reveal`}>
          <Panel id="faq" title="FAQ nháp" sub={`${r.faq.length} · answer-first`}
            action={<CopyText text={r.faq.map((f) => `${f.question}\n${f.answerDraft}`).join("\n\n")} label="Sao chép FAQ nháp" toastTitle={`Đã copy ${r.faq.length} câu FAQ`} />}>
            <div className={c.faq}>
              {r.faq.map((f, i) => (
                <details key={f.question} open={i === 0}>
                  <summary className="disclosure">{f.question}</summary>
                  <p className={c.faqAnswer}>{f.answerDraft}</p>
                </details>
              ))}
            </div>
          </Panel>
          <Panel id="luu-y" title="Không được" sub="lưu ý cho writer">
            <ul className={c.doNot}>{r.doNot.map((d) => <li key={d}><X size={14} aria-hidden /><span>{d}</span></li>)}</ul>
          </Panel>
        </div>
      </DetailLayout>
    </div>
  );
}
