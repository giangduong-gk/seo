import { Network } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, EmptyState, Panel, SystemNotice } from "@/components/ui";
import { hasApiKey } from "@/lib/claude";
import { detectKeywordOverlap } from "@/lib/cluster";
import { prisma } from "@/lib/db";
import { ProjectHeader } from "../ProjectHeader";
import { ClusterForm } from "./ClusterForm";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function ClustersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id }, include: { keywords: { orderBy: { createdAt: "desc" }, include: { _count: { select: { analyses: true } } } }, clusters: { orderBy: { createdAt: "desc" }, include: { _count: { select: { briefs: true } } } } } });
  if (!project) notFound();
  const overlaps = detectKeywordOverlap(project.keywords.map((k) => ({ term: k.term, intent: k.intent })));

  return (
    <div className="container stack page-in">
      <ProjectHeader projectId={id} active="clusters" trail="Topic Cluster" />
      {!hasApiKey() && <SystemNotice tone="amber" title="Chưa cấu hình ANTHROPIC_API_KEY">Thêm khoá vào <code className="mono">web/.env</code> để sinh cluster.</SystemNotice>}

      <div style={{ display: "grid", gap: "var(--cms-grid-gap)", gridTemplateColumns: "repeat(auto-fit, minmax(min(380px, 100%), 1fr))", alignItems: "start" }}>
        <Panel title="Xây Topic Cluster mới" sub="pillar – cluster – supporting">
          <ClusterForm projectId={id} keywords={project.keywords.map((k) => ({ id: k.id, term: k.term, intent: k.intent, analyzed: k._count.analyses > 0 }))} disabled={!hasApiKey()} />
        </Panel>
        <div className="stack">
          <Panel title="Cluster đã tạo" sub={`${project.clusters.length}`} flush>
            {project.clusters.length === 0 ? (
              <EmptyState icon={<Network size={22} />} title="Chưa có cluster" text="Chọn ít nhất 2 từ khoá ở bên cạnh để Claude xây bản đồ pillar – cluster." />
            ) : (
              <ul>
                {project.clusters.map((c) => (
                  <li key={c.id} style={{ borderBottom: "1px solid var(--line-1)" }}>
                    <Link href={`/projects/${id}/clusters/${c.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px var(--cms-panel-pad-x)", minHeight: "var(--cms-row-h)" }}>
                      <span style={{ flex: "1 1 auto", minWidth: 0 }}>
                        <span style={{ display: "block", fontWeight: 600 }}>{c.title}</span>
                        <span className="caption mono">{c.pillarKeyword} · {c.updatedAt.toLocaleDateString("vi-VN")}</span>
                      </span>
                      <Badge tone="outline">{c._count.briefs} brief</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Cảnh báo cannibalization" sub="rule engine · không tốn token">
            {overlaps.length === 0 ? (
              <p className="caption">Chưa phát hiện cặp từ khoá cùng ý định trùng ≥ 60% từ. Kiểm tra lại sau khi thêm từ khoá.</p>
            ) : (
              <ul style={{ display: "grid", gap: 8 }}>
                {overlaps.map((o) => (
                  <li key={o.a + o.b} className="body-s" style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                    <Badge tone="warning">{Math.round(o.similarity * 100)}%</Badge>
                    <span><b style={{ fontWeight: 500 }}>{o.a}</b> ↔ <b style={{ fontWeight: 500 }}>{o.b}</b></span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
