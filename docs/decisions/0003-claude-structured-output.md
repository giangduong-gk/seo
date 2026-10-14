# ADR 0003 — Claude với structured output, prompt caching và streaming

- **Trạng thái:** Chấp nhận · 10/10/2026

## Bối cảnh

Đầu ra AI (phân tích, cluster, brief, điểm) được hiển thị thành UI có cấu trúc và lưu vào DB, nên phải đúng schema. Mọi lời gọi dùng chung một bộ tiêu chuẩn SEO/GEO 2026 rất dài. Một số tác vụ chạy vài phút.

## Quyết định

- **Model:** Claude Opus 5.5 cho phân tích, cluster, brief và viết bài (chất lượng là ưu tiên). Sonnet 5.5 cho chấm điểm AI (gọi thường xuyên, cần rẻ hơn). Thinking `adaptive` và `effort` đặt theo từng tác vụ.
- **Structured output:** schema Zod → `zodOutputFormat`. Đọc `parsed_output`. Luôn kiểm tra refusal trước khi đọc nội dung.
- **Prompt caching:** tiêu chuẩn 2026 và hồ sơ dự án là các khối `system` có `cache_control`, đặt trước phần thay đổi theo yêu cầu.
- **Streaming:** `messages.stream().finalMessage()` cho tác vụ có cấu trúc. Riêng viết bài thì stream SSE ra trình duyệt.
- **Chi phí:** mọi lời gọi ghi `AiUsage` theo bảng giá trong code.
- **Chấm điểm lai:** 23 tiêu chí rule-based chạy miễn phí, 8 tiêu chí ngữ nghĩa giao cho Claude.

## Hệ quả

- ✅ UI không phải đoán định dạng; dữ liệu lưu luôn hợp lệ.
- ✅ Cache giảm mạnh chi phí input khi thao tác liên tiếp trong cùng dự án.
- ⚠️ Schema lồng quá sâu làm grammar quá lớn (đã gặp với brief). Quy tắc: giữ schema phẳng.
- ⚠️ Bảng giá trong code phải được cập nhật khi Anthropic đổi giá.

## Phương án đã cân nhắc

- **JSON mode tự parse + retry:** dễ lỗi, tốn thêm lượt gọi.
- **Một model cho mọi tác vụ:** hoặc đắt (chấm điểm bằng Opus) hoặc chất lượng thấp (viết bằng Haiku).
