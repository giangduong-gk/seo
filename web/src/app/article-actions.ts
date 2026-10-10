"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/app/actions";
import { MODELS } from "@/lib/claude";
import { prisma } from "@/lib/db";
import { toProfile } from "@/lib/project";
import { buildJsonLd, parseStoredBrief } from "@/lib/jsonld";
import { slugify, wordCount } from "@/lib/markdown";
import { ContentBrief } from "@/lib/schemas";

/* Server actions cho AI Writer (Sprint 3). File "use server": chỉ export async function. */

type ArticleWithRelations = NonNullable<Awaited<ReturnType<typeof loadArticle>>>;

function loadArticle(articleId: string) {
  return prisma.article.findUnique({ where: { id: articleId }, include: { project: true, brief: true } });
}

/** Dựng lại JSON-LD từ trạng thái mới của bài (các trường ghi đè lên bản trong DB). */
function rebuildJsonLd(
  a: ArticleWithRelations,
  next: Partial<{ title: string; slug: string; metaDescription: string; bodyMarkdown: string }>,
): string {
  const project = toProfile(a.project);
  const brief = parseStoredBrief(a.brief?.data);
  return JSON.stringify(
    buildJsonLd({
      project,
      brief,
      article: {
        title: next.title ?? a.title,
        slug: next.slug ?? a.slug,
        metaDescription: next.metaDescription ?? a.metaDescription,
        bodyMarkdown: next.bodyMarkdown ?? a.bodyMarkdown,
        targetKeyword: a.targetKeyword,
        createdAt: a.createdAt,
        updatedAt: new Date(),
      },
    }),
  );
}

const articlePath = (projectId: string, articleId: string) => `/projects/${projectId}/articles/${articleId}`;

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Tạo bài viết mới từ brief (ưu tiên) hoặc từ từ khoá mục tiêu, rồi chuyển tới trang bài với autostart. */
export async function createArticle(_prev: ActionState, form: FormData): Promise<ActionState> {
  const projectId = String(form.get("projectId") ?? "");
  const briefId = String(form.get("briefId") ?? "").trim() || null;
  const targetKeywordInput = String(form.get("targetKeyword") ?? "").trim().replace(/\s+/g, " ");
  if (!projectId) return { error: "Thiếu dự án" };

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { error: "Không tìm thấy dự án" };

  let data: { title: string; slug: string; metaDescription: string; targetKeyword: string; briefId: string | null };
  if (briefId) {
    const b = await prisma.brief.findUnique({ where: { id: briefId } });
    if (!b || b.projectId !== projectId) return { error: "Không tìm thấy brief" };
    let parsed: ContentBrief | null = null;
    try {
      const r = ContentBrief.safeParse(JSON.parse(b.data));
      parsed = r.success ? r.data : null;
    } catch { parsed = null; }
    if (!parsed) return { error: "Brief không đúng schema" };
    const title = parsed.title.trim() || b.title;
    data = {
      title,
      slug: slugify(parsed.slug) || slugify(title),
      metaDescription: parsed.metaDescription,
      targetKeyword: parsed.targetKeyword || b.targetKeyword,
      briefId: b.id,
    };
  } else {
    if (targetKeywordInput.length < 2) return { error: "Chọn brief hoặc nhập từ khoá mục tiêu (tối thiểu 2 ký tự)" };
    data = {
      title: capitalize(targetKeywordInput),
      slug: slugify(targetKeywordInput),
      metaDescription: "",
      targetKeyword: targetKeywordInput,
      briefId: null,
    };
  }
  if (!data.slug) return { error: "Không tạo được slug từ tiêu đề" };

  const article = await prisma.article.create({
    data: { projectId, ...data, status: "draft", model: MODELS.analysis },
  });
  revalidatePath(`/projects/${projectId}/articles`);
  redirect(`${articlePath(projectId, article.id)}?autostart=1`);
}

const SaveArticle = z.object({
  title: z.string().trim().min(2, "Tiêu đề tối thiểu 2 ký tự"),
  slug: z.string().trim().transform(slugify),
  metaDescription: z.string().trim().max(300, "Meta description quá dài").default(""),
  bodyMarkdown: z.string().default(""),
});

/** Lưu chỉnh sửa thủ công; lưu bản cũ thành revision khi nội dung đổi. */
export async function saveArticle(
  articleId: string,
  data: { title: string; slug: string; metaDescription: string; bodyMarkdown: string },
  note?: string,
): Promise<{ ok: true; words: number } | { ok: false; error: string }> {
  const parsed = SaveArticle.safeParse(data);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  const d = parsed.data;
  const a = await loadArticle(articleId);
  if (!a) return { ok: false, error: "Không tìm thấy bài viết" };
  if (a.status === "writing") return { ok: false, error: "Bài đang được AI viết, đợi xong rồi lưu" };

  const slug = d.slug || slugify(d.title);
  if (!slug) return { ok: false, error: "Slug không hợp lệ" };
  const bodyChanged = d.bodyMarkdown !== a.bodyMarkdown;

  await prisma.$transaction([
    ...(bodyChanged && a.bodyMarkdown.trim()
      ? [prisma.articleRevision.create({ data: { articleId, bodyMarkdown: a.bodyMarkdown, note: note?.trim() || "Lưu thủ công" } })]
      : []),
    prisma.article.update({
      where: { id: articleId },
      data: {
        title: d.title,
        slug,
        metaDescription: d.metaDescription,
        bodyMarkdown: d.bodyMarkdown,
        jsonLd: rebuildJsonLd(a, { title: d.title, slug, metaDescription: d.metaDescription, bodyMarkdown: d.bodyMarkdown }),
        // Bài trống thì vẫn là draft; có nội dung mà đang draft thì chuyển sang review
        ...(a.status === "draft" && d.bodyMarkdown.trim() ? { status: "review" } : {}),
      },
    }),
  ]);
  revalidatePath(articlePath(a.projectId, articleId));
  return { ok: true, words: wordCount(d.bodyMarkdown) };
}

export async function setArticleStatus(articleId: string, status: "draft" | "review" | "final"): Promise<{ ok: boolean }> {
  if (!["draft", "review", "final"].includes(status)) return { ok: false };
  const a = await prisma.article.findUnique({ where: { id: articleId }, select: { projectId: true, status: true } });
  if (!a || a.status === "writing") return { ok: false };
  await prisma.article.update({ where: { id: articleId }, data: { status } });
  revalidatePath(articlePath(a.projectId, articleId));
  revalidatePath(`/projects/${a.projectId}/articles`);
  return { ok: true };
}

/** Khôi phục một revision: nội dung hiện tại được lưu thành revision mới trước khi ghi đè. */
export async function restoreRevision(articleId: string, revisionId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const a = await loadArticle(articleId);
  if (!a) return { ok: false, error: "Không tìm thấy bài viết" };
  if (a.status === "writing") return { ok: false, error: "Bài đang được AI viết" };
  const rev = await prisma.articleRevision.findUnique({ where: { id: revisionId } });
  if (!rev || rev.articleId !== articleId) return { ok: false, error: "Không tìm thấy bản lưu" };

  await prisma.$transaction([
    ...(a.bodyMarkdown.trim()
      ? [prisma.articleRevision.create({ data: { articleId, bodyMarkdown: a.bodyMarkdown, note: "Trước khi khôi phục" } })]
      : []),
    prisma.article.update({
      where: { id: articleId },
      data: {
        bodyMarkdown: rev.bodyMarkdown,
        jsonLd: rebuildJsonLd(a, { bodyMarkdown: rev.bodyMarkdown }),
        status: rev.bodyMarkdown.trim() ? "review" : "draft",
      },
    }),
  ]);
  revalidatePath(articlePath(a.projectId, articleId));
  return { ok: true };
}

export async function deleteArticle(form: FormData) {
  const articleId = String(form.get("articleId") ?? "");
  const a = await prisma.article.findUnique({ where: { id: articleId }, select: { projectId: true } });
  if (!a) return;
  await prisma.article.delete({ where: { id: articleId } });
  revalidatePath(`/projects/${a.projectId}/articles`);
  redirect(`/projects/${a.projectId}/articles`);
}
