import { z } from "zod";

/** Ý định tìm kiếm theo phân loại chuẩn. */
export const Intent = z.enum(["informational", "commercial", "transactional", "navigational", "mixed"]);
export type Intent = z.infer<typeof Intent>;

export const KeywordItem = z.object({
  term: z.string(),
  role: z.enum(["primary", "secondary", "long_tail", "question", "ai_prompt"]),
  note: z.string().nullable(),
});

export const EntityItem = z.object({
  name: z.string(),
  type: z.string().describe("Loại thực thể: Organization, Product, Person, Place, Concept..."),
  relation: z.string().describe("Quan hệ với chủ đề chính, một câu ngắn"),
  schemaHint: z.string().nullable().describe("Gợi ý schema.org type hoặc thuộc tính sameAs"),
});

export const SerpInsight = z.object({
  winningFormats: z.array(z.string()).describe("Định dạng nội dung đang thắng: guide, listicle, so sánh, review..."),
  typicalLengthWords: z.number().int().nullable(),
  commonHeadings: z.array(z.string()),
  contentGaps: z.array(z.string()).describe("Câu hỏi/khía cạnh top kết quả chưa trả lời tốt"),
  competitors: z.array(
    z.object({ url: z.string().nullable(), title: z.string(), takeaway: z.string() }),
  ),
  dataConfidence: z.enum(["web_research", "model_estimate"]),
});

export const ClusterSuggestion = z.object({
  pillar: z.string(),
  clusters: z.array(z.object({ title: z.string(), targetKeyword: z.string(), intent: Intent })),
  internalLinks: z.array(z.object({ from: z.string(), to: z.string(), anchor: z.string() })),
});

export const GeoChecklistItem = z.object({
  id: z.string(),
  label: z.string(),
  why: z.string(),
  priority: z.enum(["must", "should", "nice"]),
});

/** Kết quả phân tích một từ khoá/chủ đề — khung dữ liệu cho bước Brief và Writer. */
export const KeywordAnalysis = z.object({
  keyword: z.string(),
  language: z.string(),
  intent: Intent,
  intentConfidence: z.number().min(0).max(1),
  intentReasoning: z.string(),
  audience: z.string().describe("Ai đang tìm và họ muốn gì"),
  searchVolumeEstimate: z.enum(["very_low", "low", "medium", "high", "very_high"]),
  difficultyEstimate: z.number().int().min(0).max(100).describe("Ước tính độ khó 0-100, gắn nhãn là ước tính"),
  recommendedAngle: z.string().describe("Góc viết đề xuất để thắng cả SERP lẫn AI citation"),
  recommendedFormat: z.string(),
  keywords: z.array(KeywordItem),
  entities: z.array(EntityItem),
  serp: SerpInsight,
  cluster: ClusterSuggestion,
  geoChecklist: z.array(GeoChecklistItem),
  suggestedTitle: z.string(),
  suggestedMetaDescription: z.string(),
  faq: z.array(z.object({ question: z.string(), answerDraft: z.string() })),
});
export type KeywordAnalysis = z.infer<typeof KeywordAnalysis>;

export const EntityProfile = z.object({
  organization: z.string().optional(),
  products: z.array(z.string()).optional(),
  authors: z.array(z.string()).optional(),
  sameAs: z.array(z.string()).optional(),
});
export type EntityProfile = z.infer<typeof EntityProfile>;
