import Link from "next/link";
import { Badge } from "@/components/ui";
import { SubNav } from "@/components/shell/SubNav";
import { projectTabItems } from "@/components/shell/projectTabs";
import { MODELS } from "@/lib/claude";
import { prisma } from "@/lib/db";
import s from "./ProjectHeader.module.css";

/**
 * Đầu trang dự án gọn: breadcrumb một dòng → tên dự án (cỡ h1) + meta & badge trên một dòng tự xuống hàng
 * → SubNav dính dưới header. Chiều cao như nhau ở mọi tab (trail dài bị cắt "…") → dải tab không nhảy khi chuyển tab.
 */
export async function ProjectHeader({ projectId, active, trail }: { projectId: string; active: "analyses" | "clusters" | "briefs" | "articles"; trail?: string }) {
  const [project, counts, usage] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: projectId } }),
    Promise.all([
      prisma.analysis.count({ where: { projectId } }),
      prisma.cluster.count({ where: { projectId } }),
      prisma.brief.count({ where: { projectId } }),
      prisma.article.count({ where: { projectId } }),
    ]),
    prisma.aiUsage.aggregate({ where: { projectId }, _sum: { costUsd: true } }),
  ]);
  const base = `/projects/${projectId}`;
  const meta = [project.domain, project.industry, project.locale].filter(Boolean);
  return (
    <>
      <header className={s.head}>
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/">Dự án</Link>
          <span className="sep" aria-hidden>/</span>
          {trail ? (
            <>
              <Link href={base}>{project.name}</Link>
              <span className="sep" aria-hidden>/</span>
              <span aria-current="page" title={trail}>{trail}</span>
            </>
          ) : (
            <span aria-current="page">{project.name}</span>
          )}
        </nav>
        <h1 className={s.title}>{project.name}</h1>
        <div className={s.meta}>
          {meta.length > 0 && <span className={s.metaText}>{meta.join(" · ")}</span>}
          <span className={s.badges}>
            <Badge tone="outline" title="Model phân tích">{MODELS.analysis}</Badge>
            <Badge tone="neutral" title="Chi phí AI ước tính của dự án">${(usage._sum.costUsd ?? 0).toFixed(3)}</Badge>
          </span>
        </div>
      </header>
      <SubNav items={projectTabItems(projectId, active, { analyses: counts[0], clusters: counts[1], briefs: counts[2], articles: counts[3] })} />
    </>
  );
}
