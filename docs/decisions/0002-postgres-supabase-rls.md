# ADR 0002 — PostgreSQL trên Supabase, schema `seo`, RLS mặc định từ chối

- **Trạng thái:** Chấp nhận · 12/10/2026 (thay cho SQLite dùng trong Sprint 1–3)

## Bối cảnh

SQLite đủ cho thử nghiệm một máy, nhưng không chạy được trên serverless, không có sao lưu quản lý sẵn và không mở rộng sang auth/pgvector được. Lộ trình cần thêm đăng nhập, phân quyền theo dự án, tìm kiếm ngữ nghĩa và hàng đợi. Supabase cung cấp sẵn cả bốn thứ này trên Postgres.

## Quyết định

- Prisma provider `postgresql`; bảng nằm trong schema riêng **`seo`** (`?schema=seo`), không dùng `public`.
- Migration khởi tạo bật **RLS trên mọi bảng, không policy**, và thu hồi mọi quyền của `anon`/`authenticated` (kể cả default privileges).
- App kết nối bằng role chủ bảng ở server. Runtime đi qua Supavisor transaction pooler (6543, `pgbouncer=true`), migration dùng `DIRECT_URL`.
- Payload AI lưu dạng **text chứa JSON đã validate** (không dùng `jsonb`) để giữ migration đơn giản.
- Dev/test dùng Postgres 16 cục bộ (`seo_dev`, `seo_test`). CI có service `postgres:16`.

## Hệ quả

- ✅ Key công khai của Supabase (Data API) không đọc/ghi được dữ liệu — có hai lớp bảo vệ: schema không được mở và RLS từ chối.
- ✅ Cùng một bộ migration chạy được ở local, CI và production.
- ⚠️ Advisors của Supabase sẽ báo "RLS enabled, no policy" (INFO). Đây là chủ đích.
- ⚠️ Khi client cần truy cập trực tiếp (Realtime, Storage), phải viết policy theo `auth.uid()`. Đây là việc của giai đoạn Auth.
- ⚠️ Muốn truy vấn bên trong JSON thì cần migration chuyển cột sang `jsonb`.

## Phương án đã cân nhắc

- **Neon:** Postgres serverless tốt nhưng phải ghép thêm auth, storage và queue từ dịch vụ khác.
- **Giữ SQLite (Turso/libSQL):** gọn nhưng thiếu RLS, pgvector và hệ sinh thái auth.
