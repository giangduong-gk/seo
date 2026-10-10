import { notFound } from "next/navigation";
import { z } from "zod";
import { ArticleEditor, type ArticleData, type RevisionData, type ScoreView } from "@/components/article/ArticleEditor";
import { hasApiKey } from "@/lib/claude";
import { prisma } from "@/lib/db";
import { ContentBrief, ScoreCriterion } from "@/lib/schemas";
import { ProjectHeader } from "../../ProjectHeader";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CriteriaJson = z.union([
  z.object({ criteria: z.array(ScoreCriterion), summary: z.string().default("") }),
  z.array(ScoreCriterion).transform((criteria) => ({ criteria, summary: "" })),
]);

export default async function ArticlePage({ params, searchParams }: { params: Promise<{ id: string; articleId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id, articleId }, sp] = await Promise.all([params, searchParams]);
  const a = await prisma.article.findUnique({
    where: { id: articleId },
    include: {
      brief: { select: { id: true, data: true } },
      revisions: { orderBy: { createdAt: "desc" }, take: 20 },
      scores: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!a || a.projectId !== id) notFound();

  let brief = null;
  if (a.brief) {
    try { const p = ContentBrief.safeParse(JSON.parse(a.brief.data)); if (p.success) brief = p.data; } catch { brief = null; }
  }

  let initialScore: ScoreView | null = null;
  const latest = a.scores[0];
  if (latest) {
    let criteria: ScoreView["criteria"] = []; let summary = "";
    try { const p = CriteriaJson.safeParse(JSON.parse(latest.criteria)); if (p.success) { criteria = p.data.criteria; summary = p.data.summary; } } catch { /* criteria hỏng → panel vẫn hiện điểm */ }
    initialScore = { id: latest.id, createdAt: latest.createdAt.toISOString(), seoScore: latest.seoScore, geoScore: latest.geoScore, criteria, summary, model: latest.model };
  }

  const article: ArticleData = {
    id: a.id, projectId: a.projectId, briefId: a.briefId, targetKeyword: a.targetKeyword, title: a.title, slug: a.slug, metaDescription: a.metaDescription,
    bodyMarkdown: a.bodyMarkdown, jsonLd: a.jsonLd, status: a.status, model: a.model, updatedAt: a.updatedAt.toISOString(),
  };
  const revisions: RevisionData[] = a.revisions.map((r) => ({ id: r.id, note: r.note, bodyMarkdown: r.bodyMarkdown, createdAt: r.createdAt.toISOString() }));
  const autostart = (Array.isArray(sp.autostart) ? sp.autostart[0] : sp.autostart) === "1";

  return (
    <div className="container stack page-in">
      <ProjectHeader projectId={id} active="articles" trail={a.title} />
      <ArticleEditor article={article} brief={brief} revisions={revisions} initialScore={initialScore} canGenerate={hasApiKey()} autostart={autostart} />
    </div>
  );
}
