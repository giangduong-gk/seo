# ADR 0004 — Bố cục monorepo `apps/` + `docs/`

- **Trạng thái:** Chấp nhận · 14/10/2026

## Bối cảnh

Ban đầu ứng dụng nằm ở `web/`, tài liệu rải rác (`docs/PLAN.md`, `web/README.md`, `web/TESTING.md`). Lộ trình có thêm worker xử lý hàng đợi AI, có thể có tích hợp CMS và gói dùng chung (schema Zod, scorer). Dự án cũng cần một tên chính thức thay cho "SEO Studio".

## Quyết định

- Đặt tên sản phẩm **RankMind** (tagline: *AI SEO & GEO Content Studio*).
- Ứng dụng chuyển sang `apps/web` (package `rankmind-web`). Sau này thêm `apps/worker` và `packages/*` khi cần.
- Toàn bộ tài liệu nằm trong `docs/` (kiến trúc, AI, database, deploy, testing, design system, ADR, kế hoạch sản phẩm). Gốc repo chỉ giữ `README`, `CONTRIBUTING`, `SECURITY`, `CHANGELOG`.
- `package.json` ở gốc chỉ chuyển tiếp lệnh vào `apps/web` (`npm --prefix`), **chưa dùng npm workspaces** để không phải dời lockfile khi mới có một app.
- Công cụ dev đổi tên `tools/` → `scripts/`.

## Hệ quả

- ✅ Cấu trúc quen thuộc, dễ thêm app/package mới, tài liệu tập trung.
- ⚠️ Vercel đặt Root Directory = `apps/web`; CI chạy với `working-directory: apps/web`.
- ⚠️ Khi có app thứ hai, chuyển sang npm workspaces (một lockfile ở gốc) và cập nhật ADR này.
- ℹ️ Tên repo trên GitHub (`giangduong-gk/seo`) và schema DB `seo` giữ nguyên. Đổi tên repo do chủ repo thực hiện trên GitHub; schema `seo` là chi tiết nội bộ, không ảnh hưởng thương hiệu.
