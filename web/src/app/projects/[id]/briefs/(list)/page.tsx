import { FileText } from "lucide-react";
import { notFound } from "next/navigation";
import { EmptyState, Panel, SystemNotice } from "@/components/ui";
import { FilterList } from "@/components/content/FilterList";
import { TimeAgo } from "@/components/content/time";
import c from "@/components/content/content.module.css";
import { hasApiKey } from "@/lib/claude";
import { prisma } from "@/lib/db";
import { IntentBadge } from "../../IntentBadge";
import { ProjectHeader } from "../../ProjectHeader";
import { BriefForm } from "../BriefForm";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function BriefsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id }, include: { briefs: { orderBy: { createdAt: "desc" }, include: { cluster: { select: { title: true } } } }, keywords: { orderBy: { createdAt: "desc" }, select: { term: true, intent: true } } } });
  if (!project) notFound();
  const canRun = hasApiKey();

  return (
    <div className="container stack page-in">
      <ProjectHeader projectId={id} active="briefs" trail="Content Brief" />
      {!canRun && <SystemNotice tone="amber" title="Chưa cấu hình ANTHROPIC_API_KEY">Thêm khoá vào <code className="mono">web/.env</code> để tạo brief.</SystemNotice>}
      <div className={c.workspace}>
        <div className={c.workspaceForm}>
          <Panel title="Tạo Content Brief" sub="outline · E-E-A-T · schema">
            <BriefForm projectId={id} keywords={project.keywords.map((k) => k.term)} disabled={!canRun} />
          </Panel>
        </div>
        <div className={c.workspaceList}>
          <Panel title="Brief đã tạo" sub={`${project.briefs.length}`} flush>
            {project.briefs.length === 0 ? (
              <EmptyState icon={<FileText size={22} />} title="Chưa có brief" text="Nhập từ khoá mục tiêu ở khung bên cạnh, hoặc bấm “Tạo brief” trên một node trong Topic Cluster." />
            ) : (
              <FilterList
                label="Lọc brief"
                placeholder="Lọc theo tiêu đề, từ khoá…"
                items={project.briefs.map((b) => {
                  const d = JSON.parse(b.data) as { intent?: string; wordCountMin?: number; wordCountMax?: number };
                  return {
                    id: b.id,
                    href: `/projects/${id}/briefs/${b.id}`,
                    search: `${b.title} ${b.targetKeyword} ${b.cluster?.title ?? ""}`,
                    content: (
                      <>
                        <span className={c.rowMain}>
                          <span className={c.rowTitle}>{b.title}</span>
                          <span className={c.rowMeta}>
                            <span className="mono">{b.targetKeyword}</span>
                            {d.wordCountMin != null && <><span className={c.dot} aria-hidden>·</span><span>{d.wordCountMin.toLocaleString("vi-VN")}–{(d.wordCountMax ?? d.wordCountMin).toLocaleString("vi-VN")} từ</span></>}
                            {b.cluster && <><span className={c.dot} aria-hidden>·</span><span>{b.cluster.title}</span></>}
                            <span className={c.dot} aria-hidden>·</span>
                            <TimeAgo date={b.createdAt} />
                          </span>
                        </span>
                        <span className={c.rowSide}><IntentBadge intent={d.intent} /></span>
                      </>
                    ),
                  };
                })}
              />
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
