import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type Anthropic from "@anthropic-ai/sdk";
import { MODELS, assertNotRefused, claude, recordUsage } from "./claude";
import { projectProfilePrompt, standards2026, type ProjectProfile } from "./prompts";
import { ClusterMap, type KeywordAnalysis } from "./schemas";

function systemBlocks(project: ProjectProfile): Anthropic.TextBlockParam[] {
  return [
    { type: "text", text: standards2026(), cache_control: { type: "ephemeral" } },
    { type: "text", text: projectProfilePrompt(project), cache_control: { type: "ephemeral" } },
  ];
}

export type KeywordContext = { term: string; intent?: string | null; analysis?: KeywordAnalysis | null };

/** Sinh bản đồ Topic Cluster từ danh sách từ khoá (có hoặc không có phân tích kèm). */
export async function generateClusterMap(project: ProjectProfile, keywords: KeywordContext[], brief: string | null, projectId?: string) {
  const model = MODELS.analysis;
  const ctx = keywords
    .map((k) => {
      const a = k.analysis;
      const extra = a
        ? ` | intent ${a.intent} | format ${a.recommendedFormat} | từ khoá phụ: ${a.keywords.filter((x) => x.role !== "primary").slice(0, 8).map((x) => x.term).join(", ")} | gap: ${a.serp.contentGaps.slice(0, 3).join("; ")}`
        : k.intent
          ? ` | intent ${k.intent}`
          : "";
      return `- ${k.term}${extra}`;
    })
    .join("\n");

  const res = await claude().messages.stream({
    model,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: zodOutputFormat(ClusterMap) },
    system: systemBlocks(project),
    messages: [
      {
        role: "user",
        content:
          "Xây dựng bản đồ Topic Cluster (pillar – cluster – supporting) cho các từ khoá sau:\n" +
          `${ctx}\n\n` +
          (brief ? `Ghi chú thêm từ người dùng: ${brief}\n\n` : "") +
          "Yêu cầu:\n" +
          "- Đúng 1 node kind=pillar (id 'pillar', parentId null) bao quát chủ đề; 4–8 node kind=cluster (parentId 'pillar'), mỗi cluster một ý định chính, không trùng ý định với cluster khác; 0–3 supporting mỗi cluster (parentId = id cluster cha).\n" +
          "- Mọi từ khoá đầu vào phải được gán vào một node (targetKeyword hoặc secondaryKeywords); có thể thêm node mới nếu thiếu mắt xích.\n" +
          "- links: pillar ↔ mọi cluster hai chiều, cluster → supporting, và 3–6 link chéo giữa cluster có liên quan; anchor mô tả, không dùng 'tại đây'.\n" +
          "- cannibalization: liệt kê các cặp node cùng ý định và cùng chủ đề hẹp, kèm cách xử lý.\n" +
          "- priority theo giá trị kinh doanh và độ khả thi.\n" +
          `- Viết bằng ngôn ngữ ${project.locale}.`,
      },
    ],
  }).finalMessage();
  assertNotRefused(res);
  await recordUsage({ projectId, feature: "cluster_map", model, usage: res.usage });
  if (!res.parsed_output) throw new Error("Không parse được bản đồ cluster từ model.");
  return { map: res.parsed_output, model };
}

export { detectKeywordOverlap, type OverlapWarning } from "./overlap";
