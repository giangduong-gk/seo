# Kế hoạch sản phẩm — RankMind (AI SEO & GEO Content Studio)

> Website giúp người làm SEO phân tích **từ khoá – chủ đề – ý định tìm kiếm**, rồi dùng Claude để **viết và chấm điểm nội dung** theo các chuẩn SEO xu hướng 2026: GEO, E-E-A-T, RAG-ready, Topic Cluster, Entity/Schema và Multi-format.

---

## 1. Mục tiêu & phạm vi

### 1.1 Vấn đề cần giải
- Năm 2026, lưu lượng không chỉ đến từ Top Google mà còn từ **AI Overviews, ChatGPT, Perplexity, Gemini** trích dẫn nguồn. Nội dung phải vừa rank, vừa **được AI chọn làm nguồn trích dẫn**.
- Quy trình hiện tại của team SEO rời rạc: nghiên cứu keyword một nơi, lên outline một nơi, viết một nơi, kiểm tra chuẩn SEO thủ công.

### 1.2 Mục tiêu sản phẩm (MVP)
1. Nhập **từ khoá hạt giống / chủ đề / URL đối thủ** → hệ thống phân tích ý định, cụm từ khoá ngữ nghĩa, thực thể và câu hỏi người dùng.
2. Sinh **Topic Cluster** (pillar + cluster) và kế hoạch internal link.
3. Sinh **Content Brief** và **bài viết hoàn chỉnh** tối ưu GEO/E-E-A-T, kèm Schema JSON-LD, FAQ, bảng so sánh, gợi ý hình/video.
4. **Chấm điểm nội dung** theo bộ tiêu chí 2026 (SEO score + GEO score) và gợi ý sửa.
5. Xuất ra Markdown / HTML / Google Docs / WordPress.

### 1.3 Ngoài phạm vi MVP
- Crawl toàn site, audit kỹ thuật (Core Web Vitals, index).
- Tự động đăng bài lên nhiều CMS (chỉ làm WordPress ở giai đoạn 3).
- Theo dõi thứ hạng (rank tracking) – cân nhắc giai đoạn 4.

---

## 2. Người dùng & luồng sử dụng chính

| Persona | Nhu cầu |
|---|---|
| SEO Specialist | Nghiên cứu keyword nhanh, lên cluster, brief cho writer |
| Content Writer | Viết bài theo brief, có AI hỗ trợ và chấm điểm trước khi nộp |
| Marketing Manager | Xem tổng quan dự án, duyệt bài, theo dõi chi phí AI |

**Luồng chính (happy path):**

```
Tạo dự án (domain, ngành, ngôn ngữ, giọng văn, thông tin thực thể doanh nghiệp)
   → Nhập từ khoá/chủ đề
   → [Phân tích] ý định, SERP, câu hỏi, thực thể, khoảng trống nội dung
   → [Cluster] pillar/cluster map + internal link
   → [Brief] outline H1-H3, góc viết, dữ liệu cần dẫn nguồn, schema cần có
   → [Viết] bài hoàn chỉnh (streaming), multi-format blocks
   → [Chấm điểm] SEO/GEO score + checklist + đề xuất sửa (1 click áp dụng)
   → [Xuất] Markdown / HTML + JSON-LD / WordPress draft
```

---

## 3. Danh sách tính năng chi tiết

### 3.1 Module Keyword & Topic Analysis
- **Phân loại ý định tìm kiếm**: informational / commercial / transactional / navigational, kèm độ tin cậy.
- **Mở rộng từ khoá ngữ nghĩa**: LSI/entity-based keywords, long-tail, câu hỏi (People Also Ask), từ khoá "AI-prompt style" (cách người dùng hỏi chatbot).
- **Phân tích SERP & đối thủ**: dùng Claude web search tool để đọc top 10 kết quả, rút ra: định dạng thắng (listicle, guide, so sánh…), độ dài trung bình, thực thể xuất hiện, câu hỏi chưa được trả lời (content gap).
- **Khối lượng & độ khó**: tích hợp API bên thứ ba (DataForSEO / Google Keyword Planner / Ahrefs nếu có key). Nếu không có → Claude ước lượng tương đối và gắn nhãn "ước tính".
- **Thực thể (Entity extraction)**: liệt kê thực thể chính và quan hệ, gợi ý `sameAs` cho Knowledge Graph.

### 3.2 Module Topic Cluster
- Sinh bản đồ **Pillar – Cluster – Supporting** từ danh sách keyword.
- Gợi ý **internal link** (anchor text, hướng link).
- Trực quan hoá dạng sơ đồ (React Flow) và bảng; cho phép kéo-thả chỉnh sửa.
- Phát hiện **cannibalization** (nhiều bài cùng ý định).

### 3.3 Module Content Brief
- Outline H1/H2/H3 theo ý định và SERP gap.
- Yêu cầu E-E-A-T: tác giả cần có, bằng chứng/dữ liệu sơ cấp cần đưa, nguồn uy tín nên trích dẫn.
- Checklist GEO: câu trả lời trực tiếp ngay đầu mục (answer-first), định nghĩa ngắn, số liệu có nguồn, bảng so sánh, FAQ.
- Danh sách schema cần có (Article, FAQPage, HowTo, Product, Organization, Person).
- Gợi ý multi-format: ảnh/infographic, video ngắn, bảng, PDF tải về.

### 3.4 Module Viết nội dung (AI Writer)
- Viết theo brief, **streaming** ra editor (TipTap/Markdown) để người dùng theo dõi.
- Cấu trúc **machine-readable**: tiêu đề câu hỏi, đoạn trả lời 40–60 từ ngay dưới, bullet, bảng, định nghĩa in đậm.
- Chèn **trích dẫn có nguồn** (URL + ngày truy cập) từ kết quả web search; đánh dấu chỗ cần người kiểm chứng.
- Sinh **JSON-LD** đi kèm (Article + FAQPage + Organization/Person từ hồ sơ dự án).
- Chế độ: viết mới / viết lại bài cũ / mở rộng mục / rút gọn / đổi giọng văn.
- Giọng văn & thuật ngữ theo **Brand Voice** của dự án (lưu trong hồ sơ, cache prompt).

### 3.5 Module Chấm điểm (SEO + GEO Scorer)
Hai điểm 0–100 độc lập, có giải thích từng tiêu chí:

**SEO Score (truyền thống):**
- Từ khoá chính trong title, H1, 100 từ đầu, meta description, URL slug.
- Độ phủ từ khoá ngữ nghĩa (so với danh sách phân tích).
- Cấu trúc heading hợp lệ, độ dài phù hợp định dạng SERP.
- Internal/external link, alt text gợi ý.

**GEO Score (2026):**
- *Answer-first*: mỗi H2 có câu trả lời trực tiếp trong 1–2 câu đầu.
- *Citability*: số liệu, ngày tháng, nguồn rõ ràng; câu trích dẫn độc lập ngữ cảnh.
- *E-E-A-T signals*: tác giả, kinh nghiệm thực tế, bằng chứng, cập nhật.
- *Entity clarity*: thực thể chính được định nghĩa, schema đầy đủ, quan hệ rõ.
- *Freshness/RAG-ready*: dữ liệu cập nhật, có mục "Cập nhật lần cuối", bảng tóm tắt.
- *Multi-format*: có bảng, FAQ, danh sách, gợi ý media.
- *Readability for machines*: câu ngắn, ít đại từ mơ hồ, không nhồi từ khoá.

Mỗi tiêu chí trả về: `pass | warn | fail`, lý do, và **đề xuất sửa áp dụng được 1 click** (gửi lại Claude với ngữ cảnh đoạn cần sửa).

### 3.6 Module Xuất & Tích hợp
- Markdown, HTML (kèm `<script type="application/ld+json">`), DOCX.
- Google Docs (OAuth), WordPress REST (tạo draft) – giai đoạn 3.
- Lịch sử phiên bản bài viết, so sánh diff.

### 3.7 Quản trị
- Dự án / thành viên / vai trò.
- **Theo dõi chi phí AI** theo dự án (token in/out, cache hit) – quan trọng vì chi phí là biến số lớn.
- Thư viện prompt template có thể tuỳ chỉnh theo ngành.

---

## 4. Kiến trúc kỹ thuật

### 4.1 Stack đề xuất
| Lớp | Lựa chọn | Lý do |
|---|---|---|
| Frontend + BFF | **Next.js 15 (App Router, TypeScript)** | SSR, Route Handlers cho streaming, một codebase |
| UI | Tailwind + shadcn/ui, TipTap editor, React Flow | Nhanh, có editor và sơ đồ cluster |
| AI | **`@anthropic-ai/sdk`** – Claude API | SDK chính thức, hỗ trợ streaming, structured outputs, web search, caching |
| DB | PostgreSQL (Supabase hoặc Neon) + Prisma/Drizzle | Quan hệ dự án–keyword–bài viết; pgvector cho tìm bài trùng ý định |
| Hàng đợi | BullMQ + Redis (hoặc Inngest) | Tác vụ dài: phân tích SERP, viết bài dài, batch cluster |
| Auth | Auth.js / Supabase Auth | OAuth Google (để sau xuất Google Docs) |
| Lưu trữ | S3-compatible | Ảnh/PDF xuất |
| Triển khai | Vercel (web) + Railway/Fly (worker) | Tách worker vì tác vụ AI chạy nhiều phút |

### 4.2 Sơ đồ tổng thể

```
[Browser: Next.js UI, TipTap, React Flow]
        │  SSE / fetch
        ▼
[Next.js Route Handlers (BFF)]
   ├─ /api/analyze     → enqueue job "analyze"
   ├─ /api/cluster     → enqueue job "cluster"
   ├─ /api/brief       → Claude (structured output), trả JSON
   ├─ /api/write       → Claude streaming → SSE về trình duyệt
   ├─ /api/score       → Claude (structured output) + rule-engine nội bộ
   └─ /api/export/*    → Markdown/HTML/DOCX/WordPress
        │
        ▼
[Worker (BullMQ)] ── Claude API (web_search, structured outputs, caching)
        │           ── Keyword data API (DataForSEO/Ahrefs, tuỳ chọn)
        ▼
[PostgreSQL + pgvector]   [Redis]   [S3]
```

### 4.3 Cách dùng Claude API (quyết định kỹ thuật)

| Tác vụ | Model | Thiết lập |
|---|---|---|
| Viết bài, brief, phân tích SERP sâu | `claude-opus-5-5` (mặc định) | `thinking: {type:"adaptive"}`, `output_config.effort: "high"`, streaming, `max_tokens` ~64000 cho bài dài |
| Chấm điểm, mở rộng keyword hàng loạt | `claude-sonnet-5-5` | effort `medium`, structured outputs |
| Phân loại ý định số lượng lớn | `claude-haiku-5-5` | Batch API (giảm 50% chi phí) |

Nguyên tắc:
- **Structured outputs** (`output_config.format` với Zod + `client.messages.parse`) cho mọi kết quả cần JSON: phân tích keyword, cluster, brief, score. Không parse text tay.
- **Web search tool** `web_search_20260209` cho phân tích SERP/đối thủ và lấy nguồn trích dẫn; dùng `allowed_domains`/`blocked_domains` theo cấu hình dự án; `max_uses` để khống chế chi phí.
- **Prompt caching**: đặt hồ sơ dự án (brand voice, thông tin thực thể, bộ tiêu chí 2026) ở `system` với `cache_control`, nội dung thay đổi (keyword, bài) để sau. Theo dõi `usage.cache_read_input_tokens`.
- **Streaming** cho viết bài (`client.messages.stream`), đẩy SSE về UI; lưu `response.content` đầy đủ để hỗ trợ "viết tiếp".
- **Fallback khi bị từ chối**: dùng `betas: ["server-side-fallback-2026-07-01"]` + `fallbacks: "default"`; luôn kiểm tra `stop_reason` trước khi đọc nội dung.
- Không dùng `budget_tokens`, không prefill assistant, không `tool_choice: any` (bị từ chối trên model 5.x).

Ví dụ lõi (TypeScript) cho bước chấm điểm:

```ts
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const Criterion = z.object({
  id: z.string(),
  status: z.enum(["pass", "warn", "fail"]),
  reason: z.string(),
  fix: z.string().nullable(),
});
const ScoreResult = z.object({
  seoScore: z.number(),
  geoScore: z.number(),
  criteria: z.array(Criterion),
});

const client = new Anthropic();

export async function scoreArticle(projectSystemPrompt: string, article: string) {
  const res = await client.messages.parse({
    model: "claude-sonnet-5-5",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: zodOutputFormat(ScoreResult) },
    system: [
      { type: "text", text: projectSystemPrompt, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: `Chấm điểm bài viết sau theo bộ tiêu chí SEO/GEO 2026:\n\n${article}` }],
  });
  if (res.stop_reason === "refusal") throw new Error("Model refused");
  return res.parsed_output!;
}
```

### 4.4 Mô hình dữ liệu (rút gọn)

```
Project(id, name, domain, industry, locale, brandVoice, entityProfile(json), createdBy)
Keyword(id, projectId, term, intent, volume?, difficulty?, source, clusterId?)
Cluster(id, projectId, pillarKeywordId, name, status)
Brief(id, projectId, clusterId, keywordId, outline(json), eeatRequirements(json), schemaPlan(json))
Article(id, projectId, briefId, title, slug, bodyMarkdown, jsonLd(json), status, version)
Score(id, articleId, seoScore, geoScore, criteria(json), createdAt)
AiUsage(id, projectId, model, inputTokens, outputTokens, cacheReadTokens, costUsd, feature)
Source(id, articleId, url, title, accessedAt, quote)
```

### 4.5 Bộ tiêu chí 2026 (rule engine + AI)
- Các tiêu chí **đo được bằng code** (keyword trong title/H1, độ dài, heading hợp lệ, JSON-LD valid) → rule engine TypeScript, chạy tức thì, không tốn token.
- Các tiêu chí **cần hiểu ngữ nghĩa** (answer-first, citability, E-E-A-T, entity clarity) → Claude với structured output.
- Bộ tiêu chí lưu dạng cấu hình (JSON) để cập nhật khi thuật toán thay đổi mà không sửa code.

---

## 5. Lộ trình triển khai

| Giai đoạn | Thời gian | Kết quả |
|---|---|---|
| **0. Khởi tạo** | Tuần 1 | Repo Next.js + TS, Prisma schema, Auth, CI lint/test, `.env` cho `ANTHROPIC_API_KEY`, trang Project |
| **1. Keyword & Topic Analysis** | Tuần 2–3 | Nhập keyword → phân tích ý định, mở rộng ngữ nghĩa, câu hỏi, thực thể; SERP analysis bằng web search; lưu DB |
| **2. Cluster + Brief** | Tuần 4–5 | Sinh pillar/cluster, sơ đồ React Flow, internal link; Content Brief theo chuẩn GEO/E-E-A-T |
| **3. AI Writer + Scorer** | Tuần 6–8 | Viết bài streaming vào editor, JSON-LD, nguồn trích dẫn; SEO/GEO Score và sửa 1 click; xuất Markdown/HTML |
| **4. Tích hợp & vận hành** | Tuần 9–10 | WordPress draft, Google Docs, theo dõi chi phí AI, prompt template theo ngành, Batch API cho phân loại hàng loạt |
| **5. Đánh giá chất lượng** | Liên tục | Bộ eval 30–50 bài mẫu, chấm bởi chuyên gia SEO, hill-climb prompt; A/B giọng văn |

Mốc MVP dùng được nội bộ: **cuối giai đoạn 3**.

### 5.1 Hạ tầng Supabase (sau Sprint 3)

| Bước | Trạng thái | Nội dung |
|---|---|---|
| **1. Database** | ✅ Xong (12/10/2026) | Prisma chuyển SQLite → PostgreSQL, schema riêng `seo`, migration `20261011043442_init` (index theo dự án/thời gian, `timestamptz`), **RLS bật trên mọi bảng, không policy, thu hồi quyền `anon`/`authenticated`**; dữ liệu cũ chép sang Supabase (52 bản ghi, đối chiếu md5 từng dòng); e2e/CI chạy trên Postgres `seo_test` |
| 2. Auth & quyền | Chờ duyệt | Supabase Auth (Google + magic link), thành viên/vai trò theo dự án, giới hạn chi phí AI theo dự án |
| 3. Deploy | Chờ duyệt | Vercel + Supabase (pooler 6543 cho runtime, `prisma migrate deploy` trong pipeline) |
| 4. Mở rộng | Chờ duyệt | pgvector (tìm bài trùng ý định), hàng đợi pgmq cho tác vụ AI dài |

---

## 6. Rủi ro & cách giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| Chi phí token cao khi viết bài dài, nhiều người dùng | Prompt caching, Sonnet/Haiku cho tác vụ phụ, Batch API, hạn mức theo dự án, hiển thị chi phí trước khi chạy |
| AI bịa số liệu/nguồn (hallucination) | Bắt buộc nguồn từ web search, đánh dấu "cần kiểm chứng", không cho xuất nếu còn mục chưa xác minh (tuỳ chọn) |
| Không có dữ liệu volume/difficulty thật | Tích hợp DataForSEO (rẻ, có API); khi không có thì gắn nhãn ước tính rõ ràng |
| Request dài vượt timeout | Worker + hàng đợi, streaming, `max_tokens` lớn chỉ trong stream |
| Model từ chối chủ đề nhạy cảm (y tế, tài chính YMYL) | Bật server-side fallback, xử lý `stop_reason: "refusal"` và báo người dùng rõ ràng |
| Thuật toán AI/Google thay đổi | Bộ tiêu chí để trong cấu hình JSON, có versioning |
| Nội dung trùng lặp giữa các bài | pgvector so khớp ý định/outline trước khi tạo brief |

---

## 7. Chỉ số thành công (KPI)
- Thời gian từ keyword → bài nháp đạt GEO score ≥ 80: **< 20 phút**.
- ≥ 70% bài do AI viết được writer chấp nhận với < 30% chỉnh sửa.
- Tỷ lệ bài được AI Overview/Perplexity trích dẫn tăng (đo thủ công theo mẫu) sau 3 tháng.
- Chi phí AI trung bình/bài trong hạn mức đặt ra (theo dõi bảng `AiUsage`).

---

## 8. Việc cần làm ngay (Sprint 1)
1. Khởi tạo Next.js + TypeScript, Tailwind, shadcn/ui, Prisma + PostgreSQL.
2. Cài `@anthropic-ai/sdk`, tạo `lib/claude.ts` (client, model config, helper streaming + parse, ghi `AiUsage`).
3. Viết schema Zod cho: `KeywordAnalysis`, `ClusterMap`, `ContentBrief`, `ScoreResult`.
4. Thiết kế system prompt "SEO/GEO 2026 Standards" (đặt tại `prompts/standards-2026.md`, cacheable).
5. Màn hình: Tạo dự án → Nhập keyword → Kết quả phân tích (bảng + thẻ ý định).
6. Bộ 10 keyword mẫu tiếng Việt để kiểm thử end-to-end.
