import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { MODELS, assertNotRefused, claude, recordUsage, textOf } from "./claude";
import { projectProfilePrompt, standards2026, type ProjectProfile } from "./prompts";
import { KeywordAnalysis } from "./schemas";

const WEB_SEARCH_ON = (process.env.ENABLE_WEB_SEARCH ?? "true") !== "false";
const WEB_SEARCH_MAX_USES = Number(process.env.WEB_SEARCH_MAX_USES ?? 5);

function systemBlocks(project: ProjectProfile): Anthropic.TextBlockParam[] {
  // Thứ tự cố định → prefix ổn định cho prompt caching: standards (cache) → hồ sơ dự án (cache).
  return [
    { type: "text", text: standards2026(), cache_control: { type: "ephemeral" } },
    { type: "text", text: projectProfilePrompt(project), cache_control: { type: "ephemeral" } },
  ];
}

/**
 * Bước 1 (tuỳ chọn): đọc SERP thực tế bằng Claude web search, trả về ghi chú văn bản.
 * Tách riêng khỏi bước structured output để kết quả search không xung đột với format JSON.
 */
export async function researchSerp(project: ProjectProfile, keyword: string, projectId?: string) {
  if (!WEB_SEARCH_ON) return null;
  const model = MODELS.analysis;
  const res = await claude().messages.stream({
    model,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system: systemBlocks(project),
    tools: [
      {
        type: "web_search_20260209",
        name: "web_search",
        max_uses: WEB_SEARCH_MAX_USES,
        // Không truyền user_location: API từ chối một số mã quốc gia (VN). Thị trường được nêu trong prompt.
      },
    ],
    messages: [
      {
        role: "user",
        content:
          `Nghiên cứu SERP cho từ khoá: "${keyword}" (thị trường ${project.locale}; tìm bằng ngôn ngữ của thị trường và ưu tiên website phục vụ thị trường đó).\n` +
          "Tìm top kết quả hiện tại và tóm tắt bằng văn bản có cấu trúc:\n" +
          "1) Danh sách 5–8 kết quả nổi bật: URL, tiêu đề, định dạng, điểm mạnh, điểm thiếu.\n" +
          "2) Các heading/câu hỏi lặp lại nhiều.\n" +
          "3) Độ dài ước tính của bài top.\n" +
          "4) Thực thể, số liệu, nguồn được trích dẫn nhiều.\n" +
          "5) Content gap: câu hỏi người dùng chưa được trả lời tốt.\n" +
          "Chỉ ghi điều có trong kết quả tìm được; không bịa URL.",
      },
    ],
  }).finalMessage();
  assertNotRefused(res);
  await recordUsage({ projectId, feature: "serp_research", model, usage: res.usage });
  return textOf(res);
}

/** Bước 2: phân tích từ khoá có cấu trúc (structured output, Zod). */
export async function analyzeKeyword(
  project: ProjectProfile,
  keyword: string,
  research: string | null,
  projectId?: string,
) {
  const model = MODELS.analysis;
  const res = await claude().messages.stream({
    model,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: zodOutputFormat(KeywordAnalysis) },
    system: systemBlocks(project),
    messages: [
      {
        role: "user",
        content:
          `Phân tích từ khoá / chủ đề: "${keyword}".\n\n` +
          (research
            ? `## Ghi chú nghiên cứu SERP (từ web search, dùng làm bằng chứng; đặt serp.dataConfidence = "web_research")\n${research}\n\n`
            : `## Không có dữ liệu web. Đặt serp.dataConfidence = "model_estimate" và nói rõ đây là ước tính.\n\n`) +
          "Yêu cầu:\n" +
          "- Phân loại ý định, độ tin cậy, đối tượng.\n" +
          "- Mở rộng 15–30 từ khoá ngữ nghĩa, chia vai trò (primary/secondary/long_tail/question/ai_prompt — ai_prompt là cách người dùng hỏi chatbot).\n" +
          "- 5–12 thực thể kèm gợi ý schema.\n" +
          "- Gợi ý topic cluster (1 pillar, 4–8 cluster) và internal link.\n" +
          "- Checklist GEO/E-E-A-T 6–10 mục, ưu tiên must/should/nice.\n" +
          "- Title ≤ 60 ký tự có năm 2026 nếu hợp lý, meta ≤ 155 ký tự, 4–6 FAQ với câu trả lời nháp answer-first.\n" +
          `- Viết bằng ngôn ngữ ${project.locale}.`,
      },
    ],
  }).finalMessage();
  assertNotRefused(res);
  await recordUsage({ projectId, feature: "keyword_analysis", model, usage: res.usage });
  if (!res.parsed_output) throw new Error("Không parse được kết quả phân tích từ model.");
  return { result: res.parsed_output, model };
}
