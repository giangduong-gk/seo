# Pipeline AI

Mọi lời gọi Claude nằm trong `apps/web/src/lib/`. Tài liệu này mô tả model, cách dựng prompt, cách lấy kết quả có cấu trúc và cách tính chi phí. Lý do chọn: [ADR 0003](decisions/0003-claude-structured-output.md).

## 1. Model và cấu hình theo tác vụ

| Tác vụ (`AiUsage.feature`) | Module | Model | Effort | Đầu ra |
| --- | --- | --- | --- | --- |
| `serp_research` | `analyze.ts → researchSerp` | Opus 5.5 | medium | Văn bản nghiên cứu SERP (web search, tối đa `WEB_SEARCH_MAX_USES` lần) |
| `keyword_analysis` | `analyze.ts → analyzeKeyword` | Opus 5.5 | high | `KeywordAnalysis` (Zod) |
| `cluster_map` | `cluster.ts → generateClusterMap` | Opus 5.5 | high | `ClusterMap` |
| `content_brief` | `brief.ts → generateBrief` | Opus 5.5 | medium | `ContentBrief` (schema phẳng — xem mục 5) |
| `article_write` / `article_fix` | `writer.ts → streamArticle` | Opus 5.5 | `CLAUDE_EFFORT_WRITER` (mặc định medium) | Markdown, stream SSE |
| `article_score` | `scorer.ts → runAiChecks` | Sonnet 5.5 | medium | `AiScoreOutput` (8 tiêu chí) |

- Model phân tích đổi được bằng `CLAUDE_MODEL_ANALYSIS`. Hằng `MODELS` ở `lib/claude.ts`.
- Mọi lời gọi dùng `thinking: { type: "adaptive" }`. Model tự quyết định mức suy luận trong giới hạn `effort`.
- Web search dùng tool `web_search_20260209`. **Không** truyền `user_location` vì API chưa hỗ trợ mã quốc gia VN (trả về lỗi 400).

## 2. Cấu trúc prompt & prompt caching

```
system:
  [1] prompts/standards-2026.md        ← bộ tiêu chuẩn SEO/GEO 2026 (dài, ổn định)   cache_control: ephemeral
  [2] hồ sơ dự án (projectProfilePrompt) ← tên, domain, ngành, giọng văn, thực thể     cache_control: ephemeral
  [3] (writer) brief của bài            ← chỉ khi viết/sửa bài                       cache_control: ephemeral
messages:
  [user] yêu cầu cụ thể của tác vụ (từ khoá, ngữ cảnh cluster, tiêu chí cần sửa…)
```

Phần ổn định đặt trước, phần thay đổi đặt sau, nên các lần gọi liên tiếp trong cùng dự án đọc lại cache. Giá đọc cache chỉ ~5% giá input. Muốn sửa tiêu chuẩn thì sửa `apps/web/prompts/standards-2026.md`. `prompts.ts` đọc file một lần và giữ trong bộ nhớ.

## 3. Structured output

- Schema Zod ở `lib/schemas.ts` được truyền qua `output_config.format = zodOutputFormat(Schema)`. Kết quả đọc từ `parsed_output` đã được validate.
- Trước khi đọc nội dung luôn gọi `assertNotRefused(msg)`: nếu `stop_reason = "refusal"` thì ném `RefusalError` và UI hiển thị lý do.
- Các tác vụ dài gọi `messages.stream(...).finalMessage()` để tránh timeout của một request HTTP chờ quá lâu.

## 4. Chấm điểm SEO/GEO

| Nhóm | Số tiêu chí | Cách tính | Chi phí |
| --- | --- | --- | --- |
| Rule (`runRuleChecks`) | 23 | Thuần code: từ khoá ở title/H1/intro/meta/slug, độ dài, heading, mật độ, độ phủ ngữ nghĩa, link, ảnh alt, bảng, FAQ, ngày cập nhật, câu ngắn, dẫn nguồn… | 0 |
| AI (`runAiChecks`) | 8 | Claude Sonnet: answer-first, citability, E-E-A-T, thực thể, độ mới, machine-readability, rủi ro bịa số liệu, khớp ý định | ~0,04–0,05 USD/lần |

`computeScores` tính điểm SEO và GEO (0–100) theo trọng số từng tiêu chí: `pass` = 1, `warn` = 0,5, `fail` = 0. Nút **"Sửa"** gửi `criterion.fix` sang writer ở chế độ `fix`. Bản trước khi sửa được lưu vào `ArticleRevision`.

## 5. Bài học vận hành

| Vấn đề gặp phải | Cách xử lý |
| --- | --- |
| `compiled grammar is too large` với schema brief lồng sâu | Làm phẳng `ContentBrief` (danh sách chuỗi thay vì object lồng) |
| Lời gọi structured dài bị treo/timeout | Chuyển sang `messages.stream().finalMessage()` |
| Web search lỗi 400 "Country code VN is not supported" | Bỏ `user_location` |
| Bài viết vượt độ dài brief | Giới hạn cứng `wordCountMax` trong prompt writer |
| Brief với effort `high` mất hơn 5 phút | Brief dùng effort `medium` |

## 6. Chi phí

- Bảng giá/1M token nằm ở `PRICE` trong `lib/claude.ts`. Cập nhật bảng này khi Anthropic đổi giá.
- `estimateCostUsd` tính cả token đọc và ghi cache. `recordUsage` ghi vào `AiUsage`. Trang **Chi phí AI** (`/usage`) tổng hợp theo dự án và theo tính năng.
- Chi phí tham khảo (10/2026) cho một vòng phân tích → cluster → brief → viết → chấm: khoảng **1,5–2,5 USD**. Phần lớn đến từ Opus khi viết bài và làm brief.
