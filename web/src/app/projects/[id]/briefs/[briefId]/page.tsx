import { Download } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Chip, Panel, SystemNotice } from "@/components/ui";
import { hasApiKey } from "@/lib/claude";
import { prisma } from "@/lib/db";
import { ContentBrief } from "@/lib/schemas";
import { IntentBadge } from "../../IntentBadge";
import { ProjectHeader } from "../../ProjectHeader";
import { ArticleForm } from "../../articles/ArticleForm";
import { CopyButton } from "./CopyButton";

export const dynamic = "force-dynamic";

const PRIORITY_TONE = { must: "danger", should: "warning", nice: "neutral" } as const;

export default async function BriefPage({ params }: { params: Promise<{ id: string; briefId: string }> }) {
  const { id, briefId } = await params;
  const b = await prisma.brief.findUnique({ where: { id: briefId }, include: { cluster: { select: { id: true, title: true } }, project: { select: { name: true } } } });
  if (!b || b.projectId !== id) notFound();
  const parsed = ContentBrief.safeParse(JSON.parse(b.data));
  if (!parsed.success) return <div className="container stack page-in"><SystemNotice tone="red" title="Brief không đúng schema">{parsed.error.issues[0]?.message}</SystemNotice></div>;
  const r = parsed.data;
  const mdUrl = `/api/briefs/${b.id}/markdown`;

  return (
    <div className="container stack page-in">
      <ProjectHeader projectId={id} active="briefs" trail={r.title} />

      <div className="row-head">
        <div className="text">
          <div className="micro">Content Brief · {b.createdAt.toLocaleString("vi-VN")}{b.cluster && <> · cluster <Link href={`/projects/${id}/clusters/${b.cluster.id}`} style={{ textDecoration: "underline" }}>{b.cluster.title}</Link></>}</div>
          <h1 className="h1" style={{ marginTop: 8 }}>{r.title}</h1>
          <div className="row" style={{ marginTop: 10 }}>
            <IntentBadge intent={r.intent} />
            <Badge tone="outline">{r.format}</Badge>
            <Badge tone="outline">{r.wordCountMin}–{r.wordCountMax} từ</Badge>
            <span className="caption mono">/{r.slug}</span>
          </div>
        </div>
        <div className="actions">
          <ArticleForm projectId={id} briefs={[]} defaultBriefId={b.id} disabled={!hasApiKey()} compact />
          <CopyButton url={mdUrl} />
          <a href={`${mdUrl}?download=1`} className="body-s" style={{ display: "inline-flex", alignItems: "center", gap: 6, height: "var(--control-h-m)", padding: "0 var(--control-pad-m)", borderRadius: "var(--radius-button)", background: "var(--volt-gradient)", color: "var(--on-volt)", fontWeight: 600 }}><Download size={16} aria-hidden /> Tải Markdown</a>
        </div>
      </div>

      <div className="grid-kpi">
        <Panel title="Từ khoá mục tiêu"><div className="h3">{r.targetKeyword}</div></Panel>
        <Panel title="Đối tượng"><p className="body-s">{r.audience}</p></Panel>
        <Panel title="Giọng văn"><p className="body-s">{r.tone}</p></Panel>
        <Panel title="Cập nhật"><p className="body-s">{r.updateCadence}</p></Panel>
      </div>

      <Panel title="Góc viết & meta">
        <p style={{ fontWeight: 500 }}>{r.angle}</p>
        <div><div className="micro">Meta description · {r.metaDescription.length} ký tự</div><p className="body-s" style={{ marginTop: 4 }}>{r.metaDescription}</p></div>
      </Panel>

      <Panel title="Outline" sub={`${r.outline.length} mục · answer-first`}>
        <ol style={{ display: "grid", gap: 14 }}>
          {r.outline.map((o, i) => (
            <li key={i} style={{ paddingLeft: (o.level - 1) * 20, borderLeft: o.level > 1 ? "1px solid var(--line-2)" : "none", marginLeft: o.level > 1 ? 6 : 0 }}>
              <div className="row" style={{ gap: 8 }}>
                <span className="micro" style={{ color: o.level === 1 ? "var(--volt)" : undefined }}>H{o.level}</span>
                <span style={{ fontWeight: o.level === 1 ? 700 : 600, fontSize: o.level === 1 ? 18 : 15 }}>{o.heading}</span>
                {o.wordCount > 0 && <span className="caption mono">~{o.wordCount} từ</span>}
              </div>
              {o.answerFirst !== "" && <p className="body-s" style={{ marginTop: 4, padding: "8px 12px", background: "var(--volt-soft)", borderRadius: "var(--radius-s)", color: "var(--fg-1)" }}><span className="micro volt">answer-first</span><br />{o.answerFirst}</p>}
              {o.notes !== "" && <p className="caption" style={{ marginTop: 6 }}>{o.notes}</p>}
              {o.keywords.length > 0 && <div className="row" style={{ marginTop: 6, gap: 6 }}>{o.keywords.map((k) => <Chip key={k} muted>{k}</Chip>)}</div>}
            </li>
          ))}
        </ol>
      </Panel>

      <div style={{ display: "grid", gap: "var(--cms-grid-gap)", gridTemplateColumns: "repeat(auto-fit, minmax(min(420px, 100%), 1fr))", alignItems: "start" }}>
        <Panel title="E-E-A-T">
          <div><div className="micro">Tác giả</div><p className="body-s" style={{ marginTop: 4 }}>{r.eeatAuthor}</p></div>
          <div><div className="micro">Tín hiệu kinh nghiệm</div><ul className="body-s secondary" style={{ display: "grid", gap: 4, marginTop: 4 }}>{r.eeatExperienceSignals.map((x) => <li key={x}>· {x}</li>)}</ul></div>
          <div><div className="micro">Bằng chứng cần có</div><ul className="body-s secondary" style={{ display: "grid", gap: 4, marginTop: 4 }}>{r.eeatEvidenceNeeded.map((x) => <li key={x}>· {x}</li>)}</ul></div>
          {r.eeatSources.length > 0 && <div><div className="micro">Nguồn nên dẫn</div><ul className="body-s" style={{ display: "grid", gap: 6, marginTop: 4 }}>{r.eeatSources.map((x, i) => <li key={i}>· {x}</li>)}</ul></div>}
        </Panel>
        <Panel title="Checklist GEO" sub={`${r.geoChecklist.length}`}>
          <ul style={{ display: "grid", gap: 10 }}>
            {r.geoChecklist.map((c) => <li key={c.id}><div className="row" style={{ gap: 8 }}><span style={{ fontWeight: 500 }}>{c.label}</span><Badge tone={PRIORITY_TONE[c.priority]}>{c.priority}</Badge></div><div className="caption">{c.why}</div></li>)}
          </ul>
        </Panel>
      </div>

      <div style={{ display: "grid", gap: "var(--cms-grid-gap)", gridTemplateColumns: "repeat(auto-fit, minmax(min(420px, 100%), 1fr))", alignItems: "start" }}>
        <Panel title="Schema JSON-LD">
          <ul className="body-s" style={{ display: "grid", gap: 8 }}>{r.schemaPlan.map((x, i) => { const [type, rest] = x.split(/:(.+)/); return <li key={i}><Badge tone="outline">{type.trim()}</Badge> <span style={{ marginLeft: 6 }}>{(rest ?? "").trim()}</span></li>; })}</ul>
        </Panel>
        <Panel title="Multi-format">
          <ul className="body-s" style={{ display: "grid", gap: 8 }}>{r.multiFormat.map((x, i) => { const [type, rest] = x.split(/:(.+)/); return <li key={i}><Badge tone="outline">{type.trim()}</Badge> <span style={{ marginLeft: 6 }}>{(rest ?? "").trim()}</span></li>; })}</ul>
        </Panel>
      </div>

      <div style={{ display: "grid", gap: "var(--cms-grid-gap)", gridTemplateColumns: "repeat(auto-fit, minmax(min(420px, 100%), 1fr))", alignItems: "start" }}>
        <Panel title="Liên kết" sub={`${r.links.length}`}>
          {(["internal", "external"] as const).map((t) => { const ls = r.links.filter((l) => l.type === t); return ls.length ? <div key={t}><div className="micro">{t}</div><ul className="body-s secondary" style={{ display: "grid", gap: 4, marginTop: 4 }}>{ls.map((l, i) => <li key={i}>→ <b style={{ color: "var(--fg-1)", fontWeight: 500 }}>{l.to}</b> · anchor “{l.anchor}”{l.why ? ` — ${l.why}` : ""}</li>)}</ul></div> : null; })}
          {r.links.length === 0 && <p className="caption">Không có đề xuất liên kết.</p>}
        </Panel>
        <Panel title="Không được" sub="cho writer">
          <ul className="body-s" style={{ display: "grid", gap: 6 }}>{r.doNot.map((d) => <li key={d} style={{ display: "flex", gap: 8 }}><span style={{ color: "var(--danger)" }}>✕</span>{d}</li>)}</ul>
        </Panel>
      </div>

      <Panel title="FAQ nháp" sub="answer-first">
        <ul style={{ display: "grid", gap: 14 }}>{r.faq.map((f) => <li key={f.question}><div style={{ fontWeight: 600 }}>{f.question}</div><p className="body-s secondary" style={{ marginTop: 4 }}>{f.answerDraft}</p></li>)}</ul>
      </Panel>
    </div>
  );
}
