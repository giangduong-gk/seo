import { CircleCheck, CircleHelp, Globe, Link2, Network, Tags } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Chip, Panel, Progress, SystemNotice, Table } from "@/components/ui";
import { prisma } from "@/lib/db";
import { KeywordAnalysis } from "@/lib/schemas";
import { IntentBadge } from "../../IntentBadge";
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
const VOLUME_LABEL: Record<string, string> = { very_low: "Rất thấp", low: "Thấp", medium: "Trung bình", high: "Cao", very_high: "Rất cao" };
const PRIORITY_TONE = { must: "danger", should: "warning", nice: "neutral" } as const;

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
  const byRole = Object.keys(ROLE_LABEL).map((role) => ({ role, items: r.keywords.filter((k) => k.role === role) })).filter((g) => g.items.length);
  const difficultyTone = r.difficultyEstimate >= 70 ? "danger" : r.difficultyEstimate >= 40 ? "warning" : "success";

  return (
    <div className="container stack page-in">
      <nav className="caption" aria-label="Breadcrumb">
        <Link href="/">Dự án</Link> / <Link href={`/projects/${a.projectId}`}>{a.project.name}</Link> / {a.keyword.term}
      </nav>

      <div className="row-head">
        <div className="text">
          <div className="micro">Phân tích từ khoá · {a.createdAt.toLocaleString("vi-VN")}</div>
          <h1 className="display">{r.keyword}</h1>
          <div className="row" style={{ marginTop: 10 }}>
            <IntentBadge intent={r.intent} />
            <span className="caption mono">độ tin cậy {Math.round(r.intentConfidence * 100)}%</span>
            <Badge tone={r.serp.dataConfidence === "web_research" ? "success" : "outline"} title="Nguồn dữ liệu SERP">
              {r.serp.dataConfidence === "web_research" ? "Web research" : "Ước tính model"}
            </Badge>
            <Badge tone="outline">{a.model}</Badge>
          </div>
        </div>
        <div className="actions">
          <BriefForm projectId={a.projectId} defaultKeyword={r.keyword} disabled={!hasApiKey()} compact />
        </div>
      </div>

      <div className="grid-kpi">
        <Panel title="Khối lượng tìm kiếm" sub="ước tính">
          <div className="h2">{VOLUME_LABEL[r.searchVolumeEstimate]}</div>
          <p className="caption">Chưa nối API dữ liệu volume; đây là ước tính tương đối của model.</p>
        </Panel>
        <Panel title="Độ khó" sub="ước tính 0–100">
          <div className="h2 mono">{r.difficultyEstimate}</div>
          <Progress value={r.difficultyEstimate / 100} tone={difficultyTone} label="Mức cạnh tranh" />
        </Panel>
        <Panel title="Định dạng đề xuất">
          <div className="h3">{r.recommendedFormat}</div>
          <p className="caption">Độ dài tham chiếu top SERP: {r.serp.typicalLengthWords ? `${r.serp.typicalLengthWords.toLocaleString("vi-VN")} từ` : "—"}</p>
        </Panel>
        <Panel title="Đối tượng">
          <p className="body-s">{r.audience}</p>
        </Panel>
      </div>

      <Panel title="Ý định & góc viết đề xuất">
        <p className="body-s secondary">{r.intentReasoning}</p>
        <p style={{ fontWeight: 500 }}>{r.recommendedAngle}</p>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))" }}>
          <div>
            <div className="micro">Title đề xuất · {r.suggestedTitle.length} ký tự</div>
            <div style={{ fontWeight: 600, marginTop: 4 }}>{r.suggestedTitle}</div>
          </div>
          <div>
            <div className="micro">Meta description · {r.suggestedMetaDescription.length} ký tự</div>
            <div className="body-s" style={{ marginTop: 4 }}>{r.suggestedMetaDescription}</div>
          </div>
        </div>
      </Panel>

      <Panel title="Từ khoá ngữ nghĩa" sub={`${r.keywords.length}`} action={<Tags size={16} className="muted" aria-hidden />}>
        {byRole.map((g) => (
          <div key={g.role}>
            <div className="micro" style={{ marginBottom: 8 }}>{ROLE_LABEL[g.role]} · {g.items.length}</div>
            <div className="row">
              {g.items.map((k) => <Chip key={k.term} selected={g.role === "primary"} muted={g.role === "ai_prompt"} title={k.note ?? undefined}>{k.term}</Chip>)}
            </div>
          </div>
        ))}
      </Panel>

      <div style={{ display: "grid", gap: "var(--cms-grid-gap)", gridTemplateColumns: "repeat(auto-fit, minmax(min(420px, 100%), 1fr))", alignItems: "start" }}>
        <Panel title="Thực thể & Schema" sub={`${r.entities.length}`} action={<Network size={16} className="muted" aria-hidden />} flush>
          <Table columns={["Thực thể", "Loại", "Quan hệ", "Schema"]} rows={r.entities.map((e) => [e.name, e.type, e.relation, <span key="s" className="mono">{e.schemaHint ?? "—"}</span>])} minWidth={560} />
        </Panel>

        <Panel title="SERP & đối thủ" action={<Globe size={16} className="muted" aria-hidden />}>
          <div>
            <div className="micro" style={{ marginBottom: 8 }}>Định dạng đang thắng</div>
            <div className="row">{r.serp.winningFormats.map((f) => <Chip key={f}>{f}</Chip>)}</div>
          </div>
          {r.serp.commonHeadings.length > 0 && (
            <div>
              <div className="micro" style={{ marginBottom: 8 }}>Heading lặp lại</div>
              <ul className="body-s secondary" style={{ display: "grid", gap: 4 }}>{r.serp.commonHeadings.map((h) => <li key={h}>· {h}</li>)}</ul>
            </div>
          )}
          <div>
            <div className="micro" style={{ marginBottom: 8 }}>Content gap — cơ hội</div>
            <ul className="body-s" style={{ display: "grid", gap: 6 }}>{r.serp.contentGaps.map((g) => <li key={g} style={{ display: "flex", gap: 8 }}><CircleHelp size={14} className="volt" style={{ flex: "none", marginTop: 3 }} aria-hidden />{g}</li>)}</ul>
          </div>
          {r.serp.competitors.length > 0 && (
            <div>
              <div className="micro" style={{ marginBottom: 8 }}>Kết quả nổi bật</div>
              <ul style={{ display: "grid", gap: 10 }}>
                {r.serp.competitors.map((c, i) => (
                  <li key={i} className="body-s">
                    <div style={{ fontWeight: 500 }}>{c.url ? <a href={c.url} target="_blank" rel="noreferrer noopener" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>{c.title}</a> : c.title}</div>
                    <div className="secondary">{c.takeaway}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Gợi ý Topic Cluster" sub={`pillar: ${r.cluster.pillar}`} action={<Link2 size={16} className="muted" aria-hidden />}>
        <Table
          columns={["Bài cluster", "Từ khoá mục tiêu", "Ý định"]}
          rows={r.cluster.clusters.map((c) => [c.title, <span key="k" className="mono">{c.targetKeyword}</span>, <IntentBadge key="i" intent={c.intent} />])}
        />
        {r.cluster.internalLinks.length > 0 && (
          <div>
            <div className="micro" style={{ marginBottom: 8 }}>Internal link đề xuất</div>
            <ul className="body-s secondary" style={{ display: "grid", gap: 4 }}>
              {r.cluster.internalLinks.map((l, i) => <li key={i}><b style={{ color: "var(--fg-1)", fontWeight: 500 }}>{l.from}</b> → {l.to} · anchor: <i>“{l.anchor}”</i></li>)}
            </ul>
          </div>
        )}
      </Panel>

      <div style={{ display: "grid", gap: "var(--cms-grid-gap)", gridTemplateColumns: "repeat(auto-fit, minmax(min(420px, 100%), 1fr))", alignItems: "start" }}>
        <Panel title="Checklist GEO / E-E-A-T" sub={`${r.geoChecklist.length}`}>
          <ul style={{ display: "grid", gap: 12 }}>
            {r.geoChecklist.map((c) => (
              <li key={c.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <CircleCheck size={16} className="muted" style={{ flex: "none", marginTop: 2 }} aria-hidden />
                <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                  <div className="row" style={{ gap: 8 }}><span style={{ fontWeight: 500 }}>{c.label}</span><Badge tone={PRIORITY_TONE[c.priority]}>{c.priority}</Badge></div>
                  <div className="caption">{c.why}</div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="FAQ nháp" sub="answer-first">
          <ul style={{ display: "grid", gap: 14 }}>
            {r.faq.map((f) => (
              <li key={f.question}>
                <div style={{ fontWeight: 600 }}>{f.question}</div>
                <p className="body-s secondary" style={{ marginTop: 4 }}>{f.answerDraft}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {a.research && (
        <details>
          <summary className="caption" style={{ cursor: "pointer" }}>Ghi chú nghiên cứu SERP thô (web search)</summary>
          <pre className="body-s secondary" style={{ marginTop: 10, padding: 16, background: "var(--bg-1)", border: "1px solid var(--line-1)", borderRadius: "var(--radius-m)" }}>{a.research}</pre>
        </details>
      )}
    </div>
  );
}
