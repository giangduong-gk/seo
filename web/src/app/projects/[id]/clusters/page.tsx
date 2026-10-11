import { Network } from "lucide-react";
import { notFound } from "next/navigation";
import { Badge, EmptyState, Panel, SystemNotice } from "@/components/ui";
import { FilterList } from "@/components/content/FilterList";
import { TimeAgo } from "@/components/content/time";
import c from "@/components/content/content.module.css";
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
  const canRun = hasApiKey();

  return (
    <div className="container stack page-in">
      <ProjectHeader projectId={id} active="clusters" trail="Topic Cluster" />
      {!canRun && <SystemNotice tone="amber" title="Chưa cấu hình ANTHROPIC_API_KEY">Thêm khoá vào <code className="mono">web/.env</code> để sinh cluster.</SystemNotice>}

      <div className={c.workspace}>
        <div className={c.workspaceForm}>
          <Panel title="Xây Topic Cluster mới" sub="pillar – cluster – supporting" className={c.clipPanel}>
            <ClusterForm projectId={id} keywords={project.keywords.map((k) => ({ id: k.id, term: k.term, intent: k.intent, analyzed: k._count.analyses > 0 }))} disabled={!canRun} />
          </Panel>
        </div>
        <div className={c.workspaceList}>
          <Panel title="Cluster đã tạo" sub={`${project.clusters.length}`} flush>
            {project.clusters.length === 0 ? (
              <EmptyState icon={<Network size={22} />} title="Chưa có cluster" text="Chọn ít nhất 2 từ khoá ở khung bên cạnh để Claude xây bản đồ pillar – cluster." />
            ) : (
              <FilterList
                label="Lọc cluster"
                placeholder="Lọc theo tiêu đề, pillar…"
                items={project.clusters.map((cl) => ({
                  id: cl.id,
                  href: `/projects/${id}/clusters/${cl.id}`,
                  search: `${cl.title} ${cl.pillarKeyword}`,
                  content: (
                    <>
                      <span className={c.rowMain}>
                        <span className={c.rowTitle}>{cl.title}</span>
                        <span className={c.rowMeta}>
                          <span className="mono">{cl.pillarKeyword}</span>
                          <span className={c.dot} aria-hidden>·</span>
                          <span>cập nhật <TimeAgo date={cl.updatedAt} /></span>
                        </span>
                      </span>
                      <span className={c.rowSide}><Badge tone={cl._count.briefs ? "info" : "outline"}>{cl._count.briefs} brief</Badge></span>
                    </>
                  ),
                }))}
              />
            )}
          </Panel>
          <Panel title="Cảnh báo cannibalization" sub="rule engine · không tốn token">
            {overlaps.length === 0 ? (
              <p className="caption" style={{ maxWidth: "var(--measure)" }}>Chưa phát hiện cặp từ khoá cùng ý định trùng ≥ 60% từ. Kiểm tra lại sau khi thêm từ khoá.</p>
            ) : (
              <ul style={{ display: "grid", gap: 10 }}>
                {overlaps.map((o) => (
                  <li key={o.a + o.b} className={c.linkRow}>
                    <Badge tone="warning">{Math.round(o.similarity * 100)}%</Badge>
                    <span style={{ minWidth: 0 }}><b>{o.a}</b> ↔ <b>{o.b}</b></span>
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
