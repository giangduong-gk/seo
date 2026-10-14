# Nhật ký thay đổi

Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/), đánh số theo [SemVer](https://semver.org/lang/vi/).

## [0.4.0] — 2026-10-14

### Thay đổi
- Đổi tên sản phẩm thành **RankMind** (*AI SEO & GEO Content Studio*): wordmark, tiêu đề trang, package.
- Bố cục monorepo: ứng dụng chuyển `web/` → `apps/web/`, `tools/` → `scripts/`. Thêm `package.json` ở gốc với lệnh tiện ích (`setup`, `dev`, `check`, `db:*`).
- Bộ tài liệu mới trong `docs/`: kiến trúc, pipeline AI, cơ sở dữ liệu, triển khai, design system, ADR 0001–0004. Thêm `CONTRIBUTING`, `SECURITY`.

## [0.3.1] — 2026-10-12

### Thay đổi
- Cơ sở dữ liệu chuyển từ SQLite sang **PostgreSQL/Supabase**: schema riêng `seo`, `timestamptz`, index theo dự án/thời gian. Migration bật RLS trên mọi bảng và thu hồi quyền `anon`/`authenticated`.
- Dữ liệu hiện có đã chép sang Supabase (52 bản ghi, đối chiếu md5 từng dòng).
- e2e và CI chạy trên Postgres (`seo_test`, service `postgres:16`).

### Sửa
- Test bàn phím (Escape) không còn gây cảnh báo hydration khi trang biên dịch chậm.
- `.env.example` trước đây bị `.gitignore` chặn, nay đã được commit.

## [0.3.0] — 2026-10-11

### Thêm
- AI Writer: viết bài streaming theo brief, sửa theo tiêu chí, viết lại; lưu phiên bản; xuất Markdown/HTML/JSON-LD.
- SEO/GEO Score: 23 tiêu chí rule-based và 8 tiêu chí Claude; sửa 1 click.
- Hạ tầng QA: Vitest (67 test), Playwright e2e cùng UX gates (axe a11y, layout 4 viewport, motion, keyboard, visual), lint token màu, CI.

### Cải thiện
- UX: lớp motion, toast, thanh tiến trình điều hướng, mục lục trang, skeleton, sub-nav dính, 404 thật.
- Sơ đồ cluster: cây ngang/dọc gọn gàng, cạnh bo góc, gộp liên kết hai chiều, tự sắp xếp. Thêm sơ đồ tĩnh trong trang phân tích và brief.
- Độ tương phản `--fg-3` đạt WCAG AA; vùng chạm 40px trên cảm ứng.

## [0.2.0] — 2026-10-10

### Thêm
- Topic Cluster: sinh pillar/cluster/supporting, editor kéo thả (React Flow), internal link, cảnh báo cannibalization.
- Content Brief: outline answer-first, E-E-A-T, kế hoạch schema, FAQ; xuất Markdown.

## [0.1.0] — 2026-10-10

### Thêm
- Khởi tạo ứng dụng: dự án, phân tích từ khoá với Claude (ý định, từ khoá mở rộng, thực thể, SERP qua web search, checklist GEO), theo dõi chi phí AI, AiDoIt Design System.
