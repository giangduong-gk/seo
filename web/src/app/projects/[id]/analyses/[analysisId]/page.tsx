import { ArrowRight, CircleCheck, CircleHelp, ExternalLink, Globe, Link2, Network, Tags } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Chip, Panel, SystemNotice, Table, type BadgeTone } from "@/components/ui";
import { ClampText } from "@/components/content/ClampText";
import { CopyChips } from "@/components/content/CopyChips";
import { CopyText } from "@/components/content/CopyText";
import { DetailLayout } from "@/components/content/DetailLayout";
import { KpiTile, Meter, StepMeter } from "@/components/content/KpiTile";
import { RichText } from "@/components/content/RichText";
import { TimeAgo } from "@/components/content/time";
import c from "@/components/content/content.module.css";
import { prisma } from "@/lib/db";
import { KeywordAnalysis } from "@/lib/schemas";
import { INTENT_LABEL, IntentBadge } from "../../IntentBadge";
import { BriefForm } from "../../briefs/BriefForm";
import { hasApiKey } from "@/lib/claude";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  primary: "Chính",
  secondary: "Phụ / ngữ nghĩa",
  long_tail: "Long-tail",
  question: "Câu hỏi",
  ai_prompt: "Cách hỏi AI",
};
const VOLUME: Record<string, { label: string; step: number }> = {
  very_low: { label: "Rất thấp", step: 1 }, low: { label: "Thấp", step: 2 }, medium: { label: "Trung bình", step: 3 }, high: { label: "Cao", step: 4 }, very_high: { label: "Rất cao", step: 5 },
};
const PRIORITY: Record<string, { label: string; tone: BadgeTone; rank: number }> = {
  must: { label: "Bắt buộc", tone: "danger", rank: 0 },
  should: { label: "Nên có", tone: "warning", rank: 1 },
  nice: { label: "Tốt nếu có", tone: "neutral", rank: 2 },
};

const hostOf = (url: string | null) => { if (!url) return null; try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; } };

export default async function AnalysisPage({ params }: { params: Promise<{ id: string; analysisId: string }> }) {
  const { id, analysisId } = await params;
  const a = await prisma.analysis.findUnique({ where: { id: analysisId }, include: { project: true, keyword: true } });
  if (!a || a.projectId !== id) notFound();
  if (a.status !== "done" || !a.result) {
    return (
      <div className="container stack page-in">
        <SystemNotice tone="red" title="Phân tích không hoàn tất">{a.error ?? "Không có dữ liệu."}</SystemNotice>
      </div>
    );
  }
  const parsed = KeywordAnalysis.safeParse(JSON.parse(a.result));
  if (!parsed.success) {
    return (
      <div className="container stack page-in">
        <SystemNotice tone="red" title="Dữ liệu phân tích không đúng schema">{parsed.error.issues[0]?.message}</SystemNotice>
      </div>
    );
  }
  const r = parsed.data;
  const canRun = hasApiKey();
  const byRole = Object.keys(ROLE_LABEL).map((role) => ({ role, items: r.keywords.filter((k) => k.role === role) })).filter((g) => g.items.length);
  const difficultyTone = r.difficultyEstimate >= 70 ? "danger" : r.difficultyEstimate >= 40 ? "warning" : "success";
  const difficultyLabel = r.difficultyEstimate >= 70 ? "Khó" : r.difficultyEstimate >= 40 ? "Trung bình" : "Dễ";
  const intent = INTENT_LABEL[r.intent]?.label ?? r.intent;
  const confidence = Math.round(r.intentConfidence * 100);
  const web = r.serp.dataConfidence === "web_research";
  const checklist = [...r.geoChecklist].sort((x, y) => (PRIORITY[x.priority]?.rank ?? 9) - (PRIORITY[y.priority]?.rank ?? 9));
  const vol = VOLUME[r.searchVolumeEstimate] ?? { label: r.searchVolumeEstimate, step: 0 };

  const toc = [
    { id: "tong-quan", label: "Tổng quan" },
    { id: "y-dinh", label: "Ý định & góc viết" },
    { id: "tu-khoa", label: "Từ khoá" },
    { id: "thuc-the", label: "Thực thể" },
    { id: "serp", label: "SERP & đối thủ" },
    { id: "cluster", label: "Cluster" },
    { id: "checklist", label: "Checklist" },
    { id: "faq", label: "FAQ" },
    ...(a.research ? [{ id: "nghien-cuu", label: "Nghiên cứu" }] : []),
  ];

  return (
    <div className="container stack page-in">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Dự án</Link>
        <span className="sep" aria-hidden>/</span>
        <Link href={`/projects/${a.projectId}`}>{a.project.name}</Link>
        <span className="sep" aria-hidden>/</span>
        <span aria-current="page" title={a.keyword.term}>{a.keyword.term}</span>
      </nav>

      <header className={c.head}>
        <div className={c.headText}>
          <div className="micro">Phân tích từ khoá · <TimeAgo date={a.createdAt} /></div>
          <h1 className="display">{r.keyword}</h1>
          <div className={c.headMeta}>
            <IntentBadge intent={r.intent} />
            <Badge tone={web ? "success" : "outline"} title="Nguồn dữ liệu SERP">{web ? "Web research" : "Ước tính model"}</Badge>
            <span className="caption mono">{a.model}</span>
          </div>
        </div>
        <div className={`${c.headActions} ${c.hideWide}`}>
          <BriefForm projectId={a.projectId} defaultKeyword={r.keyword} disabled={!canRun} compact />
        </div>
      </header>

      <DetailLayout
        toc={toc}
        aside={
          <>
            <div className={c.asideTitle}>Bước tiếp theo</div>
            <p className={c.asideText}>Tạo Content Brief từ phân tích này — outline, E-E-A-T, schema.</p>
            <BriefForm projectId={a.projectId} defaultKeyword={r.keyword} disabled={!canRun} compact />
          </>
        }
      >
        <section id="tong-quan" aria-label="Tổng quan" className={`grid-kpi ${c.kpis} stagger`}>
          <KpiTile label="Ý định" value={intent} foot={<>độ tin cậy <span className="mono">{confidence}%</span></>}>
            <Meter value={r.intentConfidence} label="Độ tin cậy ý định" />
          </KpiTile>
          <KpiTile label="Khối lượng tìm kiếm" value={vol.label} foot="ước tính · chưa nối API volume">
            <StepMeter value={vol.step} label="Khối lượng tìm kiếm ước tính" />
          </KpiTile>
          <KpiTile label="Độ khó" value={<><span className={c.num}>{r.difficultyEstimate}</span><small>/100</small></>} foot={`${difficultyLabel} · ước tính`}>
            <Meter value={r.difficultyEstimate / 100} tone={difficultyTone} label="Mức cạnh tranh" />
          </KpiTile>
          <KpiTile label="Nguồn dữ liệu" value={web ? "Web research" : "Ước tính"} foot={web ? `${r.serp.competitors.length} kết quả SERP đã đọc` : "model ước tính, chưa đọc SERP thật"} />
        </section>

        <Panel id="y-dinh" title="Ý định & góc viết" className="reveal">
          <dl className={c.dl}>
            <div>
              <dt>Góc viết đề xuất</dt>
              <dd><ClampText text={r.recommendedAngle}><RichText text={r.recommendedAngle} className={c.lead} /></ClampText></dd>
            </div>
            <div>
              <dt>Định dạng đề xuất{r.serp.typicalLengthWords ? <span className={c.dtAside}>Top SERP ~{r.serp.typicalLengthWords.toLocaleString("vi-VN")} từ</span> : null}</dt>
              <dd><ClampText text={r.recommendedFormat}><RichText text={r.recommendedFormat} /></ClampText></dd>
            </div>
            <div>
              <dt>Đối tượng</dt>
              <dd><ClampText text={r.audience}><RichText text={r.audience} /></ClampText></dd>
            </div>
            <div>
              <dt>Vì sao là {intent}</dt>
              <dd className="secondary"><ClampText text={r.intentReasoning}><RichText text={r.intentReasoning} /></ClampText></dd>
            </div>
            <div>
              <dt>Title đề xuất<span className={c.dtAside}><span className={c.charCount} data-over={r.suggestedTitle.length > 60 ? "" : undefined}>{r.suggestedTitle.length}/60 ký tự</span></span></dt>
              <dd className={c.copyRow}><span style={{ fontWeight: 600 }}>{r.suggestedTitle}</span><CopyText text={r.suggestedTitle} label="Sao chép title đề xuất" toastTitle="Đã copy title" /></dd>
            </div>
            <div>
              <dt>Meta description<span className={c.dtAside}><span className={c.charCount} data-over={r.suggestedMetaDescription.length > 155 ? "" : undefined}>{r.suggestedMetaDescription.length}/155 ký tự</span></span></dt>
              <dd className={c.copyRow}><span className="body-s">{r.suggestedMetaDescription}</span><CopyText text={r.suggestedMetaDescription} label="Sao chép meta description" toastTitle="Đã copy meta description" /></dd>
            </div>
          </dl>
        </Panel>

        <Panel id="tu-khoa" title="Từ khoá ngữ nghĩa" sub={`${r.keywords.length} · bấm để copy`} className="reveal"
          action={<CopyText text={r.keywords.map((k) => k.term).join("\n")} label="Sao chép toàn bộ từ khoá" toastTitle={`Đã copy ${r.keywords.length} từ khoá`}>Copy tất cả</CopyText>}>
          {byRole.map((g) => (
            <CopyChips key={g.role} label={ROLE_LABEL[g.role]} items={g.items.map((k) => ({ term: k.term, note: k.note }))} tone={g.role === "primary" ? "primary" : g.role === "ai_prompt" ? "muted" : "default"} />
          ))}
        </Panel>

        <Panel id="thuc-the" title="Thực thể & Schema" sub={`${r.entities.length}`} action={<Network size={16} className="muted" aria-hidden />} flush className="reveal">
          <div className={c.onlyWide}>
            <Table columns={["Thực thể", "Loại", "Quan hệ", "Schema"]} rows={r.entities.map((e) => [e.name, <Badge key="t" tone="outline">{e.type}</Badge>, e.relation, <span key="s" className="mono">{e.schemaHint ?? "—"}</span>])} minWidth={640} />
          </div>
          <ul className={`${c.cards} ${c.onlyNarrow}`}>
            {r.entities.map((e) => (
              <li key={e.name} className={c.card}>
                <div className={c.cardMeta}><span className={c.cardTitle}>{e.name}</span><Badge tone="outline">{e.type}</Badge></div>
                <p className="body-s secondary">{e.relation}</p>
                {e.schemaHint && <p className="caption mono" style={{ overflowWrap: "anywhere" }}>{e.schemaHint}</p>}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel id="serp" title="SERP & đối thủ" sub={web ? "web research" : "ước tính"} action={<Globe size={16} className="muted" aria-hidden />} className="reveal">
          <div className={c.split}>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", minWidth: 0 }}>
              <div>
                <div className={c.groupLabel}>Định dạng đang thắng</div>
                <div className="row" style={{ gap: 8 }}>{r.serp.winningFormats.map((f) => <Chip key={f}>{f}</Chip>)}</div>
              </div>
              {r.serp.commonHeadings.length > 0 && (
                <div>
                  <div className={c.groupLabel}>Heading lặp lại · {r.serp.commonHeadings.length}</div>
                  <ul className={c.bullets}>{r.serp.commonHeadings.map((h) => <li key={h}>{h}</li>)}</ul>
                </div>
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className={c.groupLabel}>Content gap — cơ hội · {r.serp.contentGaps.length}</div>
              <ul className={c.iconList}>{r.serp.contentGaps.map((g) => <li key={g}><CircleHelp size={14} className="volt" aria-hidden /><span>{g}</span></li>)}</ul>
            </div>
          </div>
          {r.serp.competitors.length > 0 && (
            <div>
              <div className={c.groupLabel}>Kết quả nổi bật · {r.serp.competitors.length}</div>
              <ol className={c.competitors}>
                {r.serp.competitors.map((x, i) => {
                  const host = hostOf(x.url);
                  return (
                    <li key={i} className={c.competitor}>
                      <span className={c.host}>{String(i + 1).padStart(2, "0")}{host ? ` · ${host}` : ""}</span>
                      {x.url ? <a href={x.url} target="_blank" rel="noreferrer noopener">{x.title} <ExternalLink size={12} aria-hidden style={{ verticalAlign: "-1px" }} /></a> : <span style={{ fontWeight: 500 }}>{x.title}</span>}
                      <p className={c.takeaway}>{x.takeaway}</p>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </Panel>

        <Panel id="cluster" title="Gợi ý Topic Cluster" sub={`${r.cluster.clusters.length} bài`} className="reveal"
          action={<Link href={`/projects/${a.projectId}/clusters`} className="caption" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--fg-2)", minHeight: 32 }}>Xây cluster <ArrowRight size={14} aria-hidden /></Link>}>
          <div>
            <div className={c.groupLabel}>Pillar</div>
            <div style={{ fontWeight: 600, maxWidth: "var(--measure)" }}>{r.cluster.pillar}</div>
          </div>
          <div className={c.split}>
            <div style={{ minWidth: 0 }}>
              <div className={c.groupLabel}>Bài cluster · {r.cluster.clusters.length}</div>
              <ul className={c.plan}>
                {r.cluster.clusters.map((x) => (
                  <li key={x.title + x.targetKeyword}>
                    <span style={{ fontWeight: 500, maxWidth: "var(--measure)" }}>{x.title}</span>
                    <span className={c.cardMeta}><span className="caption mono" style={{ overflowWrap: "anywhere" }}>{x.targetKeyword}</span><IntentBadge intent={x.intent} /></span>
                  </li>
                ))}
              </ul>
            </div>
          {r.cluster.internalLinks.length > 0 && (
            <div style={{ minWidth: 0 }}>
              <div className={c.groupLabel}><Link2 size={12} aria-hidden style={{ verticalAlign: "-1px" }} /> Internal link đề xuất · {r.cluster.internalLinks.length}</div>
              <ul style={{ display: "grid", gap: 10 }}>
                {r.cluster.internalLinks.map((l, i) => (
                  <li key={i} className={c.linkRow}><b>{l.from}</b><ArrowRight size={12} aria-hidden /><b>{l.to}</b><span className={c.anchor}>“{l.anchor}”</span></li>
                ))}
              </ul>
            </div>
          )}
          </div>
        </Panel>

        <Panel id="checklist" title="Checklist GEO / E-E-A-T" sub={`${r.geoChecklist.length}`} className="reveal">
            <ul className={`${c.check} ${c.checkWide}`}>
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

          <Panel id="faq" title="FAQ nháp" sub={`${r.faq.length} · answer-first`} className="reveal"
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

        {a.research && (
          <Panel id="nghien-cuu" title="Ghi chú nghiên cứu SERP" sub="web search · thô" action={<CopyText text={a.research} label="Sao chép ghi chú nghiên cứu" toastTitle="Đã copy ghi chú nghiên cứu" />} className="reveal">
            <details>
              <summary className={`disclosure ${c.disclosureSummary}`}>Hiện ghi chú thô ({a.research.length.toLocaleString("vi-VN")} ký tự)</summary>
              <pre className={c.research}>{a.research}</pre>
            </details>
          </Panel>
        )}
      </DetailLayout>
    </div>
  );
}
