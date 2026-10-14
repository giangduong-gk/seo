# Bắt đầu

Hướng dẫn chạy RankMind trên máy cá nhân trong khoảng 10 phút.

## 1. Yêu cầu

| Thành phần | Phiên bản | Ghi chú |
| --- | --- | --- |
| Node.js | 22 (xem `.nvmrc`) | `nvm use` ở gốc repo |
| PostgreSQL | 16+ | Docker cục bộ hoặc Supabase |
| Anthropic API key | — | Tạo tại console.anthropic.com. Không có key app vẫn chạy, chỉ khoá các nút gọi AI |

## 2. Cài đặt

```bash
git clone https://github.com/giangduong-gk/seo rankmind && cd rankmind
npm run setup
```

`npm run setup` cài phụ thuộc cho `apps/web` và tạo `apps/web/.env` từ `apps/web/.env.example` (nếu chưa có).

## 3. Cơ sở dữ liệu

Cách nhanh nhất là Postgres trong Docker:

```bash
docker run -d --name rankmind-db -p 5432:5432 \
  -e POSTGRES_USER=seo -e POSTGRES_PASSWORD=seo -e POSTGRES_DB=seo_dev postgres:16
# database riêng cho e2e (tuỳ chọn)
docker exec rankmind-db createdb -U seo seo_test
```

Rồi tạo bảng và (tuỳ chọn) nạp dữ liệu demo:

```bash
npm run db:migrate
npm run db:seed
```

Muốn dùng Supabase thay cho Docker: xem [Cơ sở dữ liệu → Supabase](database.md#4-supabase).

## 4. Biến môi trường (`apps/web/.env`)

| Biến | Bắt buộc | Mặc định | Ý nghĩa |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | Có (để dùng AI) | — | Khoá Claude API. **Không commit.** |
| `DATABASE_URL` | Có | — | URL Postgres cho runtime, luôn kèm `?schema=seo` |
| `DIRECT_URL` | Có | — | URL kết nối trực tiếp cho migration (local: giống `DATABASE_URL`) |
| `CLAUDE_MODEL_ANALYSIS` | Không | `claude-opus-5-5` | Model cho phân tích, cluster, brief, viết bài |
| `CLAUDE_EFFORT_WRITER` | Không | `medium` | Mức suy luận khi viết bài: `low` · `medium` · `high` |
| `ENABLE_WEB_SEARCH` | Không | `true` | Bật nghiên cứu SERP bằng Claude web search (tốn thêm token) |
| `WEB_SEARCH_MAX_USES` | Không | `5` | Số lần tìm kiếm tối đa mỗi phân tích |

## 5. Chạy

```bash
npm run dev        # http://localhost:3000
```

Luồng thử nhanh: **Tạo dự án** → **Phân tích từ khoá** → **Topic Cluster** (sinh từ các từ khoá đã phân tích) → **Brief** từ một node → **Bài viết** từ brief → **Chấm điểm** → **Xuất** Markdown/HTML/JSON-LD.

## 6. Lệnh hữu ích

| Lệnh (ở gốc repo) | Tác dụng |
| --- | --- |
| `npm run check` | Typecheck + 67 unit test + lint token màu |
| `npm run test:e2e` | Toàn bộ e2e (cần database `seo_test`) |
| `npm run build && npm run start` | Chạy bản production cục bộ |
| `npm run db:generate` | Sinh lại Prisma Client sau khi sửa schema |

Trong `apps/web` còn có: `npm run db:migrate:dev -- --name <ten>` (tạo migration mới), `npm run test:e2e:ux` (chỉ UX gates), `npm run ux:report`.

## 7. Sự cố thường gặp

| Hiện tượng | Nguyên nhân / cách xử lý |
| --- | --- |
| Banner vàng "Chưa cấu hình ANTHROPIC_API_KEY" | Thiếu key trong `apps/web/.env`; thêm rồi khởi động lại `npm run dev` |
| `The table seo.Project does not exist` | Chưa chạy `npm run db:migrate`, hoặc `DATABASE_URL` thiếu `?schema=seo` |
| `Can't reach database server` | Postgres chưa chạy hoặc sai cổng/mật khẩu |
| `tsc` báo lỗi trong `.next-*/types` | Thư mục build song song cũ; xoá `apps/web/.next-*` |
| `next dev` tự sửa `tsconfig.json` (thêm `.next-*/types`) | Hành vi của Next khi dùng `NEXT_DIST_DIR`; hoàn tác bằng `git checkout -- apps/web/tsconfig.json` |
| Phân tích chạy lâu (1–3 phút) | Bình thường với Opus + web search; có thể đặt `ENABLE_WEB_SEARCH=false` khi thử |
