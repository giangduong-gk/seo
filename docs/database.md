# Cơ sở dữ liệu

PostgreSQL qua Prisma 6. Production dùng **Supabase** (project `xolzvffwjlyhhtkoxlzy`, ap-southeast-1); dev/test dùng Postgres cục bộ. Lý do và đánh đổi: [ADR 0002](decisions/0002-postgres-supabase-rls.md).

## 1. Mô hình dữ liệu

```
Project 1─┬─* Keyword 1─* Analysis
          ├─* Analysis
          ├─* Cluster 1─* Brief 1─* Article 1─┬─* ArticleRevision
          ├─* Brief                           └─* Score
          ├─* Article
          └─* AiUsage   (projectId có thể null — ON DELETE SET NULL)
```

| Bảng | Vai trò | Trường đáng chú ý |
| --- | --- | --- |
| `Project` | Một website/thương hiệu | `locale`, `brandVoice`, `entityProfile` (JSON: tổ chức, tác giả, sameAs) |
| `Keyword` | Từ khoá trong dự án | duy nhất theo (`projectId`, `term`); `source` = `manual` \| `cluster` |
| `Analysis` | Kết quả phân tích một từ khoá | `research` (văn bản SERP), `result` (JSON `KeywordAnalysis`), `status`, `error` |
| `Cluster` | Bản đồ topic cluster | `data` (JSON `ClusterMap` + vị trí node + hướng `LR`/`TB`) |
| `Brief` | Content brief | `data` (JSON `ContentBrief`), `clusterId` tuỳ chọn |
| `Article` | Bài viết | `bodyMarkdown`, `jsonLd`, `status` = `draft` \| `review` \| `final` |
| `ArticleRevision` | Ảnh chụp nội dung trước mỗi lần AI sửa | `note` (lý do) |
| `Score` | Một lần chấm điểm | `seoScore`, `geoScore`, `criteria` (JSON danh sách tiêu chí) |
| `AiUsage` | Một lời gọi Claude | token vào/ra/cache, `costUsd`, `feature`, `model` |

- Khoá chính là `cuid`. Thời gian dùng `timestamptz(3)`.
- Index theo cách truy vấn của UI: (`projectId`, `createdAt`/`updatedAt`), cùng các khoá ngoại `keywordId`, `clusterId`, `briefId`, `articleId`.
- Xoá `Project` thì xoá dây chuyền mọi dữ liệu con, riêng `AiUsage` được giữ lại để còn lịch sử chi phí.

## 2. Schema `seo` và bảo mật

- Mọi bảng nằm trong schema **`seo`** (tham số `?schema=seo` trong URL). Supabase Data API chỉ mở `public`, nên các bảng này không bị phơi ra.
- Migration khởi tạo:
  - bật **RLS trên mọi bảng** và **không tạo policy nào**, nên mặc định từ chối tất cả;
  - `REVOKE ALL` trên bảng, schema và default privileges đối với `anon` và `authenticated`. Khối lệnh này chỉ chạy khi các role đó tồn tại, nên Postgres thường vẫn áp migration bình thường.
- App kết nối bằng role chủ bảng (`postgres`) qua Prisma ở server. Role này bỏ qua RLS, và việc kiểm soát quyền nằm ở tầng server.
- Khi thêm đăng nhập (giai đoạn sau), có hai hướng: viết policy theo `auth.uid()` nếu client truy cập trực tiếp, hoặc tiếp tục kiểm tra quyền ở server.

Kiểm tra nhanh (SQL editor của Supabase):

```sql
SELECT c.relname, c.relrowsecurity AS rls,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_select
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'seo' AND c.relkind = 'r';
-- mong đợi: rls = true, anon_select = false cho cả 9 bảng
```

## 3. Migration

| Việc | Lệnh (trong `apps/web`) |
| --- | --- |
| Tạo migration mới sau khi sửa `schema.prisma` (trên DB cục bộ) | `npm run db:migrate:dev -- --name <mo_ta_ngan>` |
| Áp migration (CI, staging, production) | `npm run db:migrate` (`prisma migrate deploy`, dùng `DIRECT_URL`) |
| Sinh lại Prisma Client | `npm run db:generate` |

Quy tắc:
- **Không** dùng `prisma db push` trên Supabase/production. Mọi thay đổi đi qua thư mục `prisma/migrations/` đã commit.
- Bảng mới phải bật RLS và thu hồi quyền `anon`/`authenticated` ngay trong migration. Có thể copy khối cuối của `20261011043442_init/migration.sql`.
- Thay đổi phá dữ liệu (đổi tên, đổi kiểu cột) phải tách thành nhiều bước (thêm cột mới → chép dữ liệu → bỏ cột cũ) và ghi chú trong PR.

## 4. Supabase

1. Dashboard → **Connect** → lấy hai chuỗi kết nối:
   - **Transaction pooler** (cổng 6543) → `DATABASE_URL`, thêm `?pgbouncer=true&connection_limit=1&schema=seo`.
   - **Session pooler / Direct** (cổng 5432) → `DIRECT_URL`, thêm `?schema=seo`.
2. Lần đầu nối app vào project đã có sẵn schema (đã tạo qua Supabase MCP), cần đánh dấu migration khởi tạo là đã áp:
   ```bash
   npx prisma migrate resolve --applied 20261011043442_init
   npx prisma migrate deploy        # áp phần còn lại (khoá bảng _prisma_migrations)
   ```
3. Kiểm tra trong Supabase **Advisors**. Hai cảnh báo mức INFO sau là bình thường: "RLS enabled, no policy" (đúng thiết kế) và "unused index" (chưa có lưu lượng).

**Trạng thái hiện tại (12/10/2026):** schema `seo` và 9 bảng đã được tạo trên Supabase. Dữ liệu từ bản SQLite cũ (52 bản ghi) đã được chép và đối chiếu md5 từng dòng. App chưa trỏ runtime sang Supabase vì còn chờ chuỗi kết nối.

## 5. Chuyển / nhập dữ liệu

`prisma/scripts/import-json.mjs` nhập một file JSON đã xuất (khoá theo tên model: `project`, `keyword`, …). Script giữ nguyên `id` và thời gian, chạy theo thứ tự khoá ngoại và bỏ qua bản ghi trùng:

```bash
DATABASE_URL="postgresql://…?schema=seo" node prisma/scripts/import-json.mjs export.json
```

## 6. Sao lưu

Supabase tự sao lưu hằng ngày (theo gói). Trước các migration lớn, nên xuất thủ công:

```bash
pg_dump "$DIRECT_URL" --schema=seo --no-owner -Fc -f rankmind-$(date +%F).dump
```
