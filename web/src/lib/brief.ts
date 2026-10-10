import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type Anthropic from "@anthropic-ai/sdk";
import { MODELS, assertNotRefused, claude, recordUsage } from "./claude";
import { projectProfilePrompt, standards2026, type ProjectProfile } from "./prompts";
import { ContentBrief, type ClusterMap, type KeywordAnalysis } from "./schemas";

function systemBlocks(project: ProjectProfile): Anthropic.TextBlockParam[] {
  return [
    { type: "text", text: standards2026(), cache_control: { type: "ephemeral" } },
    { type: "text", text: projectProfilePrompt(project), cache_control: { type: "ephemeral" } },
  ];
}

export type BriefInput = {
  targetKeyword: string;
  analysis?: KeywordAnalysis | null;
  research?: string | null;
  cluster?: { map: ClusterMap; nodeId: string } | null;
  notes?: string | null;
};

/** Sinh Content Brief có cấu trúc cho một từ khoá mục tiêu. */
export async function generateBrief(project: ProjectProfile, input: BriefInput, projectId?: string) {
  const model = MODELS.analysis;
  const parts: string[] = [`Tạo Content Brief cho từ khoá mục tiêu: "${input.targetKeyword}".`];

  if (input.analysis) {
    const a = input.analysis;
    parts.push(
      "## Kết quả phân tích từ khoá (dùng làm bằng chứng)\n" +
        `- Ý định: ${a.intent} (${Math.round(a.intentConfidence * 100)}%) — ${a.intentReasoning}\n` +
        `- Đối tượng: ${a.audience}\n- Góc viết: ${a.recommendedAngle}\n- Định dạng: ${a.recommendedFormat}\n` +
        `- Từ khoá: ${a.keywords.map((k) => `${k.term} (${k.role})`).join("; ")}\n` +
        `- Thực thể: ${a.entities.map((e) => `${e.name} [${e.type}]`).join("; ")}\n` +
        `- SERP: định dạng thắng ${a.serp.winningFormats.join(", ")}; độ dài ~${a.serp.typicalLengthWords ?? "?"} từ; heading lặp: ${a.serp.commonHeadings.join(" | ")}\n` +
        `- Content gap: ${a.serp.contentGaps.join(" | ")}\n` +
        `- Đối thủ: ${a.serp.competitors.map((c) => `${c.title}${c.url ? ` (${c.url})` : ""}: ${c.takeaway}`).join(" | ")}`,
    );
  }
  if (input.research) parts.push(`## Ghi chú SERP thô (web search)\n${input.research.slice(0, 12000)}`);
  if (input.cluster) {
    const { map, nodeId } = input.cluster;
    const node = map.nodes.find((n) => n.id === nodeId);
    const siblings = map.nodes.filter((n) => n.id !== nodeId).map((n) => `${n.id}: ${n.title} (${n.targetKeyword}, ${n.intent})`).join("\n");
    const links = map.links.filter((l) => l.fromId === nodeId || l.toId === nodeId).map((l) => `${l.fromId} → ${l.toId}: "${l.anchor}"`).join("\n");
    parts.push(
      `## Vị trí trong Topic Cluster "${map.pillarTitle}"\n` +
        (node ? `Bài này: ${node.kind} — ${node.title}. ${node.summary}\n` : "") +
        `Các bài khác trong cluster (để internal link và tránh trùng lặp):\n${siblings}\n` +
        (links ? `Link đã quy hoạch:\n${links}` : ""),
    );
  }
  if (input.notes) parts.push(`## Ghi chú từ người dùng\n${input.notes}`);
  parts.push(
    "## Yêu cầu\n" +
      "- Outline: H1 rồi 6–10 H2 (có H3 khi cần); mỗi H2/H3 có answerFirst là câu trả lời trực tiếp; notes ghi dữ liệu cần dẫn và định dạng (bảng/bước/ảnh).\n" +
      "- E-E-A-T: tác giả cần gì, bằng chứng kinh nghiệm, số liệu cần có, nguồn uy tín nên dẫn (chỉ URL chắc chắn tồn tại, không thì để null).\n" +
      "- GEO checklist 6–10 mục; schemaPlan đầy đủ cho định dạng; multiFormat 3–6 gợi ý có altText.\n" +
      "- internalLinks tới các bài trong cluster (nếu có), externalLinks có lý do.\n" +
      "- 4–6 FAQ answer-first; doNot 3–6 điều; updateCadence.\n" +
      `- Ngôn ngữ ${project.locale}; title ≤ 60 ký tự, metaDescription ≤ 155 ký tự.`,
  );

  const res = await claude().messages.parse({
    model,
    max_tokens: 20000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: zodOutputFormat(ContentBrief) },
    system: systemBlocks(project),
    messages: [{ role: "user", content: parts.join("\n\n") }],
  });
  assertNotRefused(res);
  await recordUsage({ projectId, feature: "content_brief", model, usage: res.usage });
  if (!res.parsed_output) throw new Error("Không parse được brief từ model.");
  return { brief: res.parsed_output, model };
}

/** Xuất brief ra Markdown để giao cho writer / dán vào Docs. */
export function briefToMarkdown(b: ContentBrief, meta?: { project?: string; createdAt?: Date }): string {
  const L: string[] = [];
  L.push(`# Content Brief: ${b.title}`);
  if (meta?.project) L.push(`> Dự án: ${meta.project}${meta.createdAt ? ` · ${meta.createdAt.toISOString().slice(0, 10)}` : ""}`);
  L.push("");
  L.push("## Thông tin chung");
  L.push(`- **Từ khoá mục tiêu:** ${b.targetKeyword}`);
  L.push(`- **Ý định:** ${b.intent}`);
  L.push(`- **Slug:** /${b.slug}`);
  L.push(`- **Meta description:** ${b.metaDescription}`);
  L.push(`- **Đối tượng:** ${b.audience}`);
  L.push(`- **Góc viết:** ${b.angle}`);
  L.push(`- **Định dạng:** ${b.format} · ${b.wordCount.min}–${b.wordCount.max} từ`);
  L.push(`- **Giọng văn:** ${b.tone}`);
  L.push(`- **Cập nhật:** ${b.updateCadence}`);
  L.push("");
  L.push("## Outline");
  for (const o of b.outline) {
    L.push(`${"#".repeat(o.level + 1)} ${o.heading}${o.wordCount ? ` _(~${o.wordCount} từ)_` : ""}`);
    if (o.answerFirst) L.push(`> **Answer-first:** ${o.answerFirst}`);
    if (o.notes) L.push(`- Ghi chú: ${o.notes}`);
    if (o.keywords.length) L.push(`- Từ khoá: ${o.keywords.join(", ")}`);
    L.push("");
  }
  L.push("## E-E-A-T");
  L.push(`- **Tác giả:** ${b.eeat.author}`);
  L.push(`- **Tín hiệu kinh nghiệm:** ${b.eeat.experienceSignals.join("; ")}`);
  L.push(`- **Bằng chứng cần có:** ${b.eeat.evidenceNeeded.join("; ")}`);
  if (b.eeat.sourcesToCite.length) {
    L.push("- **Nguồn nên dẫn:**");
    for (const s of b.eeat.sourcesToCite) L.push(`  - ${s.name}${s.url ? ` (${s.url})` : ""} — ${s.why}`);
  }
  L.push("");
  L.push("## Checklist GEO");
  for (const c of b.geoChecklist) L.push(`- [ ] **[${c.priority}]** ${c.label} — ${c.why}`);
  L.push("");
  L.push("## Schema (JSON-LD)");
  for (const s of b.schemaPlan) L.push(`- **${s.type}**: ${s.fields.join(", ")} — ${s.why}`);
  L.push("");
  L.push("## Multi-format");
  for (const m of b.multiFormat) L.push(`- **${m.type}**: ${m.description}${m.altText ? ` _(alt: ${m.altText})_` : ""}`);
  L.push("");
  if (b.internalLinks.length) {
    L.push("## Internal links");
    for (const l of b.internalLinks) L.push(`- → ${l.to} · anchor: "${l.anchor}"`);
    L.push("");
  }
  if (b.externalLinks.length) {
    L.push("## External links");
    for (const l of b.externalLinks) L.push(`- → ${l.to} · anchor: "${l.anchor}" — ${l.why}`);
    L.push("");
  }
  L.push("## FAQ");
  for (const f of b.faq) { L.push(`**${f.question}**`); L.push(f.answerDraft); L.push(""); }
  L.push("## Không được");
  for (const d of b.doNot) L.push(`- ${d}`);
  return L.join("\n");
}
