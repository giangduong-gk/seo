import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toProfile } from "@/lib/project";
import { scoreArticle, type ScoreInput } from "@/lib/scorer";
import { ContentBrief, type ScoreCriterion, type ScoreReport } from "@/lib/schemas";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type ScoreResponse = ScoreReport & { id: string; createdAt: string };

/** Giải mã cột `criteria` (JSON {criteria, summary}; chấp nhận cả mảng thuần để tương thích). */
function decodeScoreRow(row: { id: string; seoScore: number; geoScore: number; criteria: string; model: string | null; createdAt: Date }): ScoreResponse {
  let criteria: ScoreCriterion[] = [];
  let summary = "";
  try {
    const parsed = JSON.parse(row.criteria);
    if (Array.isArray(parsed)) criteria = parsed;
    else { criteria = parsed?.criteria ?? []; summary = parsed?.summary ?? ""; }
  } catch { /* dữ liệu hỏng → trả mảng rỗng */ }
  return { id: row.id, createdAt: row.createdAt.toISOString(), seoScore: row.seoScore, geoScore: row.geoScore, criteria, summary, model: row.model };
}

/** POST: chấm bài (rule + AI tuỳ chọn), lưu Score mới và trả về. Body: { withAi?: boolean } (mặc định true). */
export async function POST(req: Request, { params }: { params: Promise<{ articleId: string }> }) {
  const { articleId } = await params;
  const article = await prisma.article.findUnique({ where: { id: articleId }, include: { project: true, brief: true } });
  if (!article) return NextResponse.json({ error: "Không tìm thấy bài viết" }, { status: 404 });
  if (article.bodyMarkdown.trim().length < 50) return NextResponse.json({ error: "Bài viết chưa có nội dung để chấm" }, { status: 400 });

  let withAi = true;
  try {
    const body = await req.json();
    if (body && typeof body.withAi === "boolean") withAi = body.withAi;
  } catch { /* body rỗng hoặc không phải JSON → mặc định */ }

  let brief: ContentBrief | null = null;
  if (article.brief) {
    try {
      const r = ContentBrief.safeParse(JSON.parse(article.brief.data));
      brief = r.success ? r.data : null;
    } catch { brief = null; }
  }

  const input: ScoreInput = {
    markdown: article.bodyMarkdown,
    title: article.title,
    slug: article.slug,
    metaDescription: article.metaDescription,
    targetKeyword: article.targetKeyword,
    brief,
    locale: article.project.locale,
    domain: article.project.domain,
  };

  try {
    const report = await scoreArticle(toProfile(article.project), input, { withAi, projectId: article.projectId });
    const row = await prisma.score.create({
      data: {
        articleId: article.id,
        seoScore: report.seoScore,
        geoScore: report.geoScore,
        criteria: JSON.stringify({ criteria: report.criteria, summary: report.summary }),
        model: report.model,
      },
    });
    const res: ScoreResponse = { ...report, id: row.id, createdAt: row.createdAt.toISOString() };
    return NextResponse.json(res);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi không xác định";
    const refused = err instanceof Error && err.name === "RefusalError";
    return NextResponse.json({ error: message, refused }, { status: refused ? 422 : 500 });
  }
}

/** GET: điểm mới nhất của bài, hoặc 404. */
export async function GET(_req: Request, { params }: { params: Promise<{ articleId: string }> }) {
  const { articleId } = await params;
  const row = await prisma.score.findFirst({ where: { articleId }, orderBy: { createdAt: "desc" } });
  if (!row) return NextResponse.json({ error: "Bài viết chưa được chấm điểm" }, { status: 404 });
  return NextResponse.json(decodeScoreRow(row));
}
