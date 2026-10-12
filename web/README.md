# SEO Studio — web

Next.js 15 + TypeScript · Anthropic SDK · Prisma + PostgreSQL (Supabase ở production, Postgres cục bộ khi dev/test) · AiDoIt Design System tokens.

## Chạy local
```bash
cd web
cp .env.example .env        # điền ANTHROPIC_API_KEY, DATABASE_URL, DIRECT_URL
npm install
npx prisma migrate deploy   # tạo schema `seo` + bảng (RLS bật sẵn)
node prisma/seed.mjs        # (tuỳ chọn) dữ liệu demo
npm run dev                 # http://localhost:3000
```

Postgres cục bộ nhanh nhất: `docker run -d -p 5432:5432 -e POSTGRES_USER=seo -e POSTGRES_PASSWORD=seo -e POSTGRES_DB=seo_dev postgres:16`
(thêm database `seo_test` cho e2e: `createdb -h localhost -U seo seo_test`).

## Database (Supabase)
- Bảng nằm trong schema riêng **`seo`** (`?schema=seo` trong URL), không nằm ở `public` → không bị Data API (PostgREST) phơi ra.
- **RLS bật trên mọi bảng, không có policy** + thu hồi mọi quyền của `anon`/`authenticated` (migration `20261011043442_init`):
  key công khai không đọc/ghi được gì. App truy cập qua Prisma bằng role chủ bảng ở server.
- Runtime dùng **Supavisor transaction pooler** (cổng 6543, `pgbouncer=true&connection_limit=1`); migration dùng `DIRECT_URL` (cổng 5432).
- Đổi schema: sửa `prisma/schema.prisma` → `npx prisma migrate dev --name <ten>` (trên DB cục bộ) → commit thư mục migration →
  `npx prisma migrate deploy` với URL Supabase. Không dùng `db push` trên production.
- Chuyển dữ liệu từ DB cũ: xuất JSON rồi `DATABASE_URL=... node prisma/scripts/import-json.mjs <file.json>` (theo thứ tự khoá ngoại, bỏ qua bản ghi trùng).

## Cấu trúc
```
prompts/standards-2026.md   bộ tiêu chuẩn SEO/GEO 2026 (system prompt, cache)
prisma/schema.prisma        Project · Keyword · Analysis · AiUsage
src/lib/claude.ts           client, model, ghi chi phí, xử lý refusal
src/lib/analyze.ts          pipeline: web search SERP → structured analysis (Zod)
src/lib/cluster.ts          sinh Topic Cluster map (pillar/cluster/supporting, link, cannibalization)
src/lib/overlap.ts          rule engine phát hiện từ khoá trùng ý định (không tốn token)
src/lib/brief.ts            sinh Content Brief + xuất Markdown
src/lib/schemas.ts          Zod: KeywordAnalysis, EntityProfile…
src/styles/tokens/*.css     token AiDoIt v1.13.2 (copy nguyên, font qua next/font)
src/components/ui/*         Button, Field, Badge, Chip, Progress, Panel, Table…
src/components/cluster/*    editor Topic Cluster (React Flow, kéo thả, lưu vị trí)
src/app/                    / · /projects/[id] · …/analyses/[id] · …/clusters/[id] · …/briefs/[id] · /usage
src/app/api/briefs/[id]/markdown  xuất brief .md
```

## Bài viết (Sprint 3)
```
src/app/projects/[id]/articles/            danh sách bài + form "Viết bài" (từ brief hoặc từ khoá); …/[articleId] trình soạn thảo
src/components/article/ArticleEditor.tsx   editor Markdown 3 chế độ (soạn/xem trước/song song), lưu, trạng thái, export md/html/jsonld
src/components/article/useWriterStream.ts  đọc SSE từ POST /api/articles/[id]/write (write · fix · rewrite), huỷ bằng AbortController
src/components/article/ScorePanel.tsx      điểm SEO/GEO theo tiêu chí, nút "Sửa" gửi criterion.fix cho Writer; Brief · JSON-LD · Phiên bản ở aside
```
