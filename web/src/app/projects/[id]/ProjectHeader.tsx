import Link from "next/link";
import { Badge } from "@/components/ui";
import { SubNav } from "@/components/shell/SubNav";
import { MODELS } from "@/lib/claude";
import { prisma } from "@/lib/db";

export async function ProjectHeader({ projectId, active, trail }: { projectId: string; active: "analyses" | "clusters" | "briefs"; trail?: string }) {
  const [project, counts, usage] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: projectId } }),
    Promise.all([
      prisma.analysis.count({ where: { projectId } }),
      prisma.cluster.count({ where: { projectId } }),
      prisma.brief.count({ where: { projectId } }),
    ]),
    prisma.aiUsage.aggregate({ where: { projectId }, _sum: { costUsd: true } }),
  ]);
  const base = `/projects/${projectId}`;
  return (
    <>
      <nav className="caption" aria-label="Breadcrumb"><Link href="/">Dự án</Link> / {trail ? <><Link href={base}>{project.name}</Link> / {trail}</> : project.name}</nav>
      <div className="row-head">
        <div className="text">
          <div className="micro">{[project.domain, project.industry, project.locale].filter(Boolean).join(" · ")}</div>
          <h1 className="display">{project.name}</h1>
        </div>
        <div className="actions">
          <Badge tone="outline">{MODELS.analysis}</Badge>
          <Badge tone="neutral" title="Chi phí AI ước tính">${(usage._sum.costUsd ?? 0).toFixed(3)}</Badge>
        </div>
      </div>
      <SubNav items={[
        { href: base, label: "Phân tích từ khoá", count: counts[0], active: active === "analyses" },
        { href: `${base}/clusters`, label: "Topic Cluster", count: counts[1], active: active === "clusters" },
        { href: `${base}/briefs`, label: "Content Brief", count: counts[2], active: active === "briefs" },
      ]} />
    </>
  );
}
