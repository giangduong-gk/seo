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

/* ───────────── Sprint 2: Topic Cluster ───────────── */

export const ClusterNode = z.object({
  id: z.string().describe("slug ngắn, duy nhất trong map, vd: pillar, c1, c1-s1"),
  kind: z.enum(["pillar", "cluster", "supporting"]),
  parentId: z.string().nullable().describe("pillar → null; cluster → 'pillar'; supporting → id của cluster cha"),
  title: z.string().describe("Tiêu đề bài viết đề xuất"),
  targetKeyword: z.string(),
  intent: Intent,
  summary: z.string().describe("1–2 câu: bài này trả lời điều gì, khác bài khác ở đâu"),
  secondaryKeywords: z.array(z.string()),
  format: z.string().describe("guide, listicle, so sánh, review, landing..."),
  priority: z.enum(["high", "medium", "low"]),
});
export type ClusterNode = z.infer<typeof ClusterNode>;

export const InternalLink = z.object({
  fromId: z.string(),
  toId: z.string(),
  anchor: z.string(),
  why: z.string().nullable(),
});

export const CannibalizationWarning = z.object({
  nodeIds: z.array(z.string()).min(2),
  reason: z.string(),
  fix: z.string().describe("Gộp bài, đổi ý định, hay đổi từ khoá mục tiêu"),
});

export const ClusterMap = z.object({
  pillarTitle: z.string(),
  pillarKeyword: z.string(),
  strategy: z.string().describe("3–5 câu: logic của cluster và thứ tự ưu tiên viết"),
  nodes: z.array(ClusterNode).describe("Đúng 1 node kind=pillar, 4–8 cluster, 0–3 supporting mỗi cluster"),
  links: z.array(InternalLink),
  cannibalization: z.array(CannibalizationWarning),
});
export type ClusterMap = z.infer<typeof ClusterMap>;

/** Dữ liệu lưu DB: map + vị trí node người dùng đã kéo. */
export type StoredClusterMap = ClusterMap & { positions?: Record<string, { x: number; y: number }> };

/* ───────────── Sprint 2: Content Brief ─────────────
   Lưu ý: structured output có giới hạn kích thước grammar — giữ schema phẳng, tránh nullable/union lồng nhau. */

export const OutlineItem = z.object({
  level: z.number().int().min(1).max(3).describe("1 = H1, 2 = H2, 3 = H3"),
  heading: z.string(),
  answerFirst: z.string().describe("Câu trả lời trực tiếp 1–2 câu mở đầu mục; chuỗi rỗng với H1"),
  notes: z.string().describe("Điểm cần nói, dữ liệu cần dẫn, định dạng (bảng, bước, ảnh); chuỗi rỗng nếu không có"),
  keywords: z.array(z.string()),
  wordCount: z.number().int().describe("Số từ ước tính cho mục, 0 nếu không áp dụng"),
});

export const BriefLink = z.object({
  type: z.enum(["internal", "external"]),
  to: z.string().describe("Tiêu đề bài trong cluster (internal) hoặc tên nguồn/URL (external)"),
  anchor: z.string(),
  why: z.string().describe("Lý do đặt link; chuỗi rỗng nếu hiển nhiên"),
});

export const ContentBrief = z.object({
  title: z.string().describe("≤ 60 ký tự, có năm nếu hợp lý"),
  slug: z.string(),
  metaDescription: z.string().describe("≤ 155 ký tự"),
  targetKeyword: z.string(),
  intent: Intent,
  audience: z.string(),
  angle: z.string().describe("Góc viết khác biệt để thắng SERP và được AI trích dẫn"),
  format: z.string(),
  wordCountMin: z.number().int(),
  wordCountMax: z.number().int(),
  tone: z.string(),
  outline: z.array(OutlineItem).describe("Bắt đầu bằng H1, rồi H2/H3 theo thứ tự"),
  eeatAuthor: z.string().describe("Tác giả cần có chuyên môn gì, chức danh"),
  eeatExperienceSignals: z.array(z.string()).describe("Bằng chứng kinh nghiệm thực tế cần đưa vào"),
  eeatEvidenceNeeded: z.array(z.string()).describe("Số liệu, test, ảnh thực tế cần có"),
  eeatSources: z.array(z.string()).describe("Nguồn uy tín nên dẫn, mỗi mục: 'Tên nguồn — lý do' (kèm URL nếu chắc chắn tồn tại)"),
  geoChecklist: z.array(GeoChecklistItem),
  schemaPlan: z.array(z.string()).describe("Mỗi mục: 'Type: trường1, trường2 — lý do', vd 'FAQPage: mainEntity — mục FAQ'"),
  multiFormat: z.array(z.string()).describe("Mỗi mục: 'loại: mô tả (alt: ...)' — loại gồm image, infographic, table, video, pdf, calculator, checklist"),
  links: z.array(BriefLink),
  faq: z.array(z.object({ question: z.string(), answerDraft: z.string() })),
  updateCadence: z.string().describe("Tần suất cập nhật đề xuất và lý do"),
  doNot: z.array(z.string()).describe("Điều writer phải tránh"),
});
export type ContentBrief = z.infer<typeof ContentBrief>;

/* ───────────── Sprint 3: Article & Score ───────────── */

export const CriterionStatus = z.enum(["pass", "warn", "fail"]);

/** Một tiêu chí chấm điểm — dùng chung cho rule engine (source=rule) và Claude (source=ai). */
export const ScoreCriterion = z.object({
  id: z.string().describe("slug ổn định, vd: kw-in-title, answer-first"),
  group: z.enum(["seo", "geo"]),
  label: z.string(),
  status: CriterionStatus,
  reason: z.string().describe("Vì sao đạt/không đạt, có dẫn chứng từ bài"),
  fix: z.string().describe("Hướng dẫn sửa cụ thể để gửi cho Writer; chuỗi rỗng nếu pass"),
  source: z.enum(["rule", "ai"]),
  weight: z.number().describe("Trọng số 1–5"),
});
export type ScoreCriterion = z.infer<typeof ScoreCriterion>;

/** Output có cấu trúc của bước chấm bằng Claude — chỉ các tiêu chí ngữ nghĩa (GEO/E-E-A-T). */
export const AiScoreOutput = z.object({
  criteria: z.array(
    z.object({
      id: z.enum(["answer-first", "citability", "eeat-signals", "entity-clarity", "freshness", "machine-readability", "hallucination-risk", "intent-match"]),
      status: CriterionStatus,
      reason: z.string(),
      fix: z.string(),
    }),
  ),
  summary: z.string().describe("2–3 câu nhận xét tổng thể"),
});
export type AiScoreOutput = z.infer<typeof AiScoreOutput>;

export type ScoreReport = {
  seoScore: number; // 0–100
  geoScore: number; // 0–100
  criteria: ScoreCriterion[];
  summary: string;
  model: string | null;
};

/** Sự kiện stream từ API viết bài (SSE: `data: <json>\n\n`). */
export type WriterEvent =
  | { type: "delta"; text: string }
  | { type: "done"; articleId: string; words: number }
  | { type: "error"; message: string };

export type WriterMode = "write" | "fix" | "rewrite";
