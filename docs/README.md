# Tài liệu RankMind

| Tài liệu | Dành cho | Nội dung |
| --- | --- | --- |
| [Bắt đầu](getting-started.md) | Dev mới | Cài đặt, biến môi trường, chạy local, dữ liệu demo, sự cố thường gặp |
| [Kiến trúc](architecture.md) | Dev | Thành phần, luồng dữ liệu, cấu trúc mã nguồn, quy ước |
| [Pipeline AI](ai-pipeline.md) | Dev, PM | Cách dùng Claude: model, prompt, cache, structured output, chi phí |
| [Cơ sở dữ liệu](database.md) | Dev, DevOps | Mô hình dữ liệu, migration, Supabase, RLS, chuyển dữ liệu |
| [Triển khai](deployment.md) | DevOps | Vercel + Supabase, biến môi trường production, checklist phát hành |
| [Kiểm thử](testing.md) | Dev, QA | Vitest, Playwright, UX gates, CI, checklist QA thủ công |
| [Design system](design-system.md) | Dev, Designer | Token AiDoIt, motion, quy tắc màu, accessibility |
| [Kế hoạch sản phẩm](product/product-plan.md) | PM, mọi người | Mục tiêu, tính năng, lộ trình, rủi ro, KPI |
| [Quyết định kiến trúc](decisions/) | Dev | ADR: vì sao chọn công nghệ/cách làm hiện tại |

Tài liệu ở gốc repo: [README](../README.md) · [CONTRIBUTING](../CONTRIBUTING.md) · [SECURITY](../SECURITY.md) · [CHANGELOG](../CHANGELOG.md).

## Thuật ngữ

| Thuật ngữ | Nghĩa trong RankMind |
| --- | --- |
| **GEO** | Generative Engine Optimization — tối ưu để AI tìm kiếm (AI Overviews, ChatGPT, Perplexity…) trích dẫn nội dung |
| **Answer-first** | Mỗi mục mở bằng 1–2 câu trả lời trực tiếp, đứng độc lập được khi bị trích |
| **Pillar / Cluster / Supporting** | Ba tầng của topic cluster: trang trụ cột → trang chủ đề con → bài hỗ trợ |
| **Cannibalization** | Hai trang cùng nhắm một ý định tìm kiếm, tự tranh hạng với nhau |
| **Brief** | Bản đặc tả bài viết: outline, từ khoá, E-E-A-T, schema, FAQ, link |
| **Rule check / AI check** | Tiêu chí chấm điểm tính bằng code (miễn phí) / do Claude đánh giá (tốn token) |
