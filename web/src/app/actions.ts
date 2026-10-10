"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { analyzeKeyword, researchSerp } from "@/lib/analyze";
import { RefusalError } from "@/lib/claude";
import { prisma } from "@/lib/db";
import { toProfile } from "@/lib/project";
import { EntityProfile } from "@/lib/schemas";

const CreateProject = z.object({
  name: z.string().trim().min(2, "Tên dự án tối thiểu 2 ký tự"),
  domain: z.string().trim().optional(),
  industry: z.string().trim().optional(),
  locale: z.string().trim().default("vi-VN"),
  brandVoice: z.string().trim().optional(),
  organization: z.string().trim().optional(),
  products: z.string().trim().optional(),
  authors: z.string().trim().optional(),
  sameAs: z.string().trim().optional(),
});

export type ActionState = { error?: string } | undefined;

const list = (s?: string) => (s ? s.split(/[\n,]/).map((x) => x.trim()).filter(Boolean) : undefined);

export async function createProject(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = CreateProject.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  const d = parsed.data;
  const entity: EntityProfile = {
    organization: d.organization || undefined,
    products: list(d.products),
    authors: list(d.authors),
    sameAs: list(d.sameAs),
  };
  const project = await prisma.project.create({
    data: {
      name: d.name,
      domain: d.domain || null,
      industry: d.industry || null,
      locale: d.locale || "vi-VN",
      brandVoice: d.brandVoice || null,
      entityProfile: JSON.stringify(entity),
    },
  });
  redirect(`/projects/${project.id}`);
}


export async function runAnalysis(_prev: ActionState, form: FormData): Promise<ActionState> {
  const projectId = String(form.get("projectId") ?? "");
  const term = String(form.get("term") ?? "").trim().replace(/\s+/g, " ");
  if (!projectId) return { error: "Thiếu dự án" };
  if (term.length < 2) return { error: "Nhập từ khoá hoặc chủ đề (tối thiểu 2 ký tự)" };

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { error: "Không tìm thấy dự án" };

  const keyword = await prisma.keyword.upsert({
    where: { projectId_term: { projectId, term } },
    update: {},
    create: { projectId, term },
  });

  const profile = toProfile(project);
  let analysisId: string;
  try {
    const research = await researchSerp(profile, term, projectId).catch((e: unknown) => {
      // Web search thất bại không chặn phân tích — rơi về ước tính của model.
      console.warn("[serp_research] bỏ qua:", e instanceof Error ? e.message : e);
      return null;
    });
    const { result, model } = await analyzeKeyword(profile, term, research, projectId);
    const a = await prisma.analysis.create({
      data: { projectId, keywordId: keyword.id, status: "done", model, research, result: JSON.stringify(result) },
    });
    await prisma.keyword.update({ where: { id: keyword.id }, data: { intent: result.intent } });
    analysisId = a.id;
  } catch (e: unknown) {
    const refused = e instanceof RefusalError;
    const message = e instanceof Error ? e.message : "Lỗi không xác định";
    await prisma.analysis.create({
      data: { projectId, keywordId: keyword.id, status: refused ? "refused" : "failed", model: process.env.CLAUDE_MODEL_ANALYSIS || "claude-opus-5-5", error: message },
    });
    revalidatePath(`/projects/${projectId}`);
    return { error: refused ? `Model từ chối chủ đề này (${(e as RefusalError).category ?? "không rõ lý do"}). Thử diễn đạt lại.` : message };
  }
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}/analyses/${analysisId}`);
}
