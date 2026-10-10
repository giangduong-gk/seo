import { PenLine } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, EmptyState, Panel, SystemNotice, type BadgeTone } from "@/components/ui";
import { hasApiKey } from "@/lib/claude";
import { prisma } from "@/lib/db";
import { wordCount } from "@/lib/markdown";
import { STATUS_LABEL, scoreTone } from "@/components/article/status";
import { ProjectHeader } from "../ProjectHeader";
import { ArticleForm } from "./ArticleForm";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function ArticlesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      briefs: { orderBy: { createdAt: "desc" }, select: { id: true, title: true, targetKeyword: true } },
      articles: { orderBy: { updatedAt: "desc" }, include: { scores: { orderBy: { createdAt: "desc" }, take: 1, select: { seoScore: true, geoScore: true } } } },
    },
  });
  if (!project) notFound();
  const canGenerate = hasApiKey();

  return (
    <div className="container stack page-in">
      <ProjectHeader projectId={id} active="articles" trail="Bài viết" />
      {!canGenerate && <SystemNotice tone="amber" title="Chưa cấu hình ANTHROPIC_API_KEY">Thêm khoá vào <code className="mono">web/.env</code> để Claude viết và chấm điểm bài. Vẫn soạn thảo thủ công được.</SystemNotice>}
      <div style={{ display: "grid", gap: "var(--cms-grid-gap)", gridTemplateColumns: "repeat(auto-fit, minmax(min(380px, 100%), 1fr))", alignItems: "start" }}>
        <Panel title="Viết bài mới" sub="streaming · chấm SEO/GEO · JSON-LD">
          <ArticleForm projectId={id} briefs={project.briefs} disabled={!canGenerate} />
        </Panel>
        <Panel title="Bài viết" sub={`${project.articles.length}`} flush>
          {project.articles.length === 0 ? (
            <EmptyState icon={<PenLine size={22} />} title="Chưa có bài viết" text="Chọn một brief ở bên cạnh (hoặc nhập từ khoá) rồi bấm 'Viết bài' — Claude viết trực tiếp vào trình soạn thảo." />
          ) : (
            <ul>
              {project.articles.map((a) => {
                const st = STATUS_LABEL[a.status] ?? { label: a.status, tone: "outline" as BadgeTone };
                const sc = a.scores[0];
                return (
                  <li key={a.id} style={{ borderBottom: "1px solid var(--line-1)" }}>
                    <Link href={`/projects/${id}/articles/${a.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px var(--cms-panel-pad-x)", minHeight: "var(--cms-row-h)", flexWrap: "wrap" }}>
                      <span style={{ flex: "1 1 200px", minWidth: 0 }}>
                        <span style={{ display: "block", fontWeight: 600 }}>{a.title}</span>
                        <span className="caption mono">{a.targetKeyword} · {a.updatedAt.toLocaleDateString("vi-VN")} · {wordCount(a.bodyMarkdown)} từ</span>
                      </span>
                      <span className="row" style={{ gap: 6, flex: "none" }}>
                        {sc && <Badge tone={scoreTone(sc.seoScore)} title="Điểm SEO">SEO {sc.seoScore}</Badge>}
                        {sc && <Badge tone={scoreTone(sc.geoScore)} title="Điểm GEO">GEO {sc.geoScore}</Badge>}
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
