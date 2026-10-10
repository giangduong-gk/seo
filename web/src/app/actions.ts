"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { analyzeKeyword, researchSerp } from "@/lib/analyze";
import { RefusalError } from "@/lib/claude";
import { prisma } from "@/lib/db";
import { toProfile } from "@/lib/project";
import { ClusterMap, EntityProfile, KeywordAnalysis, type StoredClusterMap } from "@/lib/schemas";
import { generateClusterMap, type KeywordContext } from "@/lib/cluster";
import { generateBrief } from "@/lib/brief";

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
    console.error("[runAnalysis]", e instanceof Error ? `${e.name}: ${e.message}` : e);
    await prisma.analysis.create({
      data: { projectId, keywordId: keyword.id, status: refused ? "refused" : "failed", model: process.env.CLAUDE_MODEL_ANALYSIS || "claude-opus-5-5", error: message },
    });
    revalidatePath(`/projects/${projectId}`);
    return { error: refused ? `Model từ chối chủ đề này (${(e as RefusalError).category ?? "không rõ lý do"}). Thử diễn đạt lại.` : message };
  }
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}/analyses/${analysisId}`);
}

/* ───────────── Sprint 2 ───────────── */


function parseAnalysis(json: string | null): KeywordAnalysis | null {
  if (!json) return null;
  try {
    const r = KeywordAnalysis.safeParse(JSON.parse(json));
    return r.success ? r.data : null;
  } catch { return null; }
}

function friendlyError(e: unknown): string {
  console.error("[action]", e instanceof Error ? `${e.name}: ${e.message}` : e);
  if (e instanceof RefusalError) return `Model từ chối yêu cầu này (${e.category ?? "không rõ lý do"}). Thử diễn đạt lại.`;
  return e instanceof Error ? e.message : "Lỗi không xác định";
}

export async function createCluster(_prev: ActionState, form: FormData): Promise<ActionState> {
  const projectId = String(form.get("projectId") ?? "");
  const keywordIds = form.getAll("keywordIds").map(String).filter(Boolean);
  const extra = String(form.get("extraKeywords") ?? "").split(/[\n,]/).map((s) => s.trim().replace(/\s+/g, " ")).filter((s) => s.length >= 2);
  const notes = String(form.get("notes") ?? "").trim() || null;
  if (!projectId) return { error: "Thiếu dự án" };

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { error: "Không tìm thấy dự án" };

  const selected = keywordIds.length
    ? await prisma.keyword.findMany({ where: { id: { in: keywordIds }, projectId }, include: { analyses: { where: { status: "done" }, orderBy: { createdAt: "desc" }, take: 1 } } })
    : [];
  const ctx: KeywordContext[] = selected.map((k) => ({ term: k.term, intent: k.intent, analysis: parseAnalysis(k.analyses[0]?.result ?? null) }));
  for (const t of extra) if (!ctx.some((c) => c.term.toLowerCase() === t.toLowerCase())) ctx.push({ term: t });
  if (ctx.length < 2) return { error: "Chọn hoặc nhập ít nhất 2 từ khoá để xây cluster" };

  let clusterId: string;
  try {
    const { map, model } = await generateClusterMap(toProfile(project), ctx, notes, projectId);
    const c = await prisma.cluster.create({ data: { projectId, title: map.pillarTitle, pillarKeyword: map.pillarKeyword, model, data: JSON.stringify(map) } });
    // Lưu các từ khoá mới xuất hiện trong cluster vào bảng Keyword
    for (const n of map.nodes) {
      await prisma.keyword.upsert({ where: { projectId_term: { projectId, term: n.targetKeyword } }, update: { intent: n.intent }, create: { projectId, term: n.targetKeyword, intent: n.intent, source: "cluster" } });
    }
    clusterId = c.id;
  } catch (e) {
    return { error: friendlyError(e) };
  }
  revalidatePath(`/projects/${projectId}/clusters`);
  redirect(`/projects/${projectId}/clusters/${clusterId}`);
}

/** Lưu bản đồ đã chỉnh (node, link, vị trí) từ editor. */
export async function saveClusterMap(clusterId: string, data: StoredClusterMap): Promise<{ ok: true } | { ok: false; error: string }> {
  const { positions, ...rest } = data;
  const parsed = ClusterMap.safeParse(rest);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  const c = await prisma.cluster.findUnique({ where: { id: clusterId } });
  if (!c) return { ok: false, error: "Không tìm thấy cluster" };
  const stored: StoredClusterMap = { ...parsed.data, positions };
  await prisma.cluster.update({ where: { id: clusterId }, data: { title: parsed.data.pillarTitle, pillarKeyword: parsed.data.pillarKeyword, data: JSON.stringify(stored) } });
  revalidatePath(`/projects/${c.projectId}/clusters/${clusterId}`);
  return { ok: true };
}

export async function deleteCluster(form: FormData) {
  const clusterId = String(form.get("clusterId") ?? "");
  const c = await prisma.cluster.findUnique({ where: { id: clusterId } });
  if (!c) return;
  await prisma.cluster.delete({ where: { id: clusterId } });
  revalidatePath(`/projects/${c.projectId}/clusters`);
  redirect(`/projects/${c.projectId}/clusters`);
}

export async function createBrief(_prev: ActionState, form: FormData): Promise<ActionState> {
  const projectId = String(form.get("projectId") ?? "");
  const targetKeyword = String(form.get("targetKeyword") ?? "").trim().replace(/\s+/g, " ");
  const clusterId = String(form.get("clusterId") ?? "") || null;
  const nodeId = String(form.get("nodeId") ?? "") || null;
  const notes = String(form.get("notes") ?? "").trim() || null;
  if (!projectId) return { error: "Thiếu dự án" };
  if (targetKeyword.length < 2) return { error: "Nhập từ khoá mục tiêu" };

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { error: "Không tìm thấy dự án" };

  // Tận dụng phân tích + SERP research gần nhất của từ khoá nếu có
  const analysis = await prisma.analysis.findFirst({
    where: { projectId, status: "done", keyword: { term: { equals: targetKeyword } } },
    orderBy: { createdAt: "desc" },
  });
  let cluster: { map: ClusterMap; nodeId: string } | null = null;
  if (clusterId && nodeId) {
    const c = await prisma.cluster.findUnique({ where: { id: clusterId } });
    if (c) {
      const r = ClusterMap.safeParse(JSON.parse(c.data));
      if (r.success) cluster = { map: r.data, nodeId };
    }
  }

  let briefId: string;
  try {
    const { brief, model } = await generateBrief(toProfile(project), { targetKeyword, analysis: parseAnalysis(analysis?.result ?? null), research: analysis?.research ?? null, cluster, notes }, projectId);
    const b = await prisma.brief.create({ data: { projectId, clusterId, targetKeyword, title: brief.title, model, data: JSON.stringify(brief) } });
    await prisma.keyword.upsert({ where: { projectId_term: { projectId, term: targetKeyword } }, update: { intent: brief.intent }, create: { projectId, term: targetKeyword, intent: brief.intent, source: "brief" } });
    briefId = b.id;
  } catch (e) {
    return { error: friendlyError(e) };
  }
  revalidatePath(`/projects/${projectId}/briefs`);
  redirect(`/projects/${projectId}/briefs/${briefId}`);
}
