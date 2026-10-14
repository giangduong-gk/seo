# Triển khai

Mục tiêu: **Vercel** (ứng dụng Next.js) + **Supabase** (PostgreSQL). Trạng thái: chưa triển khai. Tài liệu này là quy trình chuẩn cho lần đầu và các lần phát hành sau.

> ⚠️ RankMind **chưa có đăng nhập**. Ai có URL cũng dùng được API key Claude của bạn. Bật **Vercel Deployment Protection** (Vercel Authentication hoặc mật khẩu) cho mọi môi trường cho đến khi hoàn thành giai đoạn Auth.

## 1. Chuẩn bị Supabase

1. Đã có project `xolzvffwjlyhhtkoxlzy` với schema `seo`. Nếu tạo project mới, chạy `npm run db:migrate` với `DIRECT_URL` của project đó.
2. Lấy chuỗi kết nối (Dashboard → Connect). Xem [Cơ sở dữ liệu → Supabase](database.md#4-supabase).
3. Lần đầu nối vào schema đã tạo sẵn: chạy `prisma migrate resolve --applied 20261011043442_init` rồi `prisma migrate deploy`.

## 2. Tạo project trên Vercel

| Thiết lập | Giá trị |
| --- | --- |
| Repository | `giangduong-gk/seo` |
| Root Directory | `apps/web` |
| Framework | Next.js (tự nhận) |
| Install Command | `npm ci` (script `postinstall` tự chạy `prisma generate`) |
| Build Command | `npm run build` |
| Node.js | 22.x |
| Region | `sin1` (Singapore, gần Supabase ap-southeast-1) |

Biến môi trường (Production và Preview):

| Biến | Giá trị |
| --- | --- |
| `ANTHROPIC_API_KEY` | Khoá production (khác khoá dev) |
| `DATABASE_URL` | Transaction pooler 6543 + `?pgbouncer=true&connection_limit=1&schema=seo` |
| `DIRECT_URL` | Session pooler 5432 + `?schema=seo` (chỉ dùng khi migrate) |
| `ENABLE_WEB_SEARCH` | `true` |
| `CLAUDE_EFFORT_WRITER` | `medium` |

Lưu ý thời gian chạy: viết bài và phân tích có thể mất 1–3 phút. Cần bật Fluid Compute hoặc tăng `maxDuration` của route `api/articles/[articleId]/write`, server action phân tích và brief (giới hạn tuỳ gói Vercel).

## 3. Migration khi phát hành

Không chạy migration trong build của Vercel. Mỗi build Preview cũng sẽ chạy, rất dễ áp nhầm vào production. Quy trình:

1. PR có migration mới: CI chạy e2e trên Postgres sạch qua `migrate deploy`, nên migration được kiểm chứng trước khi merge.
2. Trước khi merge vào nhánh production: chạy `npm run db:migrate` với `DIRECT_URL` production (thủ công hoặc qua job GitHub Actions có secret riêng).
3. Merge để Vercel build và deploy.

Migration phải **tương thích ngược** với phiên bản code đang chạy (thêm cột nullable, không xoá cột đang dùng). Nhờ vậy bước 2 và bước 3 có thể lệch nhau vài phút mà không gây lỗi.

## 4. Checklist phát hành

- [ ] CI xanh (typecheck · unit · build · token lint · e2e)
- [ ] Migration mới đã áp lên production và Advisors của Supabase không có cảnh báo mới mức WARN/ERROR
- [ ] Biến môi trường đủ, không có secret nào trong code hay log build
- [ ] Deployment Protection đang bật
- [ ] Smoke test thủ công: mở trang chủ → một dự án → một bài viết; chấm điểm rule (không tốn token)
- [ ] Ghi `CHANGELOG.md`, gắn tag phiên bản (`vX.Y.Z`)

## 5. Rollback

- **Code:** Vercel → Deployments → "Promote to Production" bản trước (tức thì).
- **Database:** viết migration đảo ngược (không sửa migration đã áp). Nếu mất dữ liệu: khôi phục từ bản sao lưu Supabase hoặc `pg_dump` trước khi phát hành.
