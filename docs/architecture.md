# Kiến trúc hệ thống

RankMind là **một ứng dụng Next.js duy nhất** (`apps/web`): UI, server actions và API routes chạy chung một process. Dữ liệu nằm trong PostgreSQL (Supabase ở production). Mọi lời gọi AI đi qua Claude API từ phía server. Lý do chọn kiến trúc này: [ADR 0001](decisions/0001-nextjs-single-app.md).

## 1. Sơ đồ tổng thể

```
 Trình duyệt (React 19, AiDoIt UI)
   │  form → Server Actions            │  fetch → API Routes (SSE / file)
   ▼                                   ▼
 ┌──────────────────────── apps/web (Next.js 15, Node runtime) ────────────────────────┐
 │ src/app/actions.ts            createProject · runAnalysis · createCluster ·          │
 │ src/app/article-actions.ts    saveClusterMap · createBrief · createArticle ·        │
 │                               saveArticle · setArticleStatus · restoreRevision      │
 │ src/app/api/…                 write (SSE) · score · export · brief markdown         │
 │                                         │                                           │
 │ src/lib/ ─ analyze · cluster · brief · writer · scorer (AI)                         │
 │          ─ overlap · markdown · jsonld · scorer rules (thuần code, không tốn token) │
 │          ─ claude.ts (client, chi phí, refusal) · prompts.ts · schemas.ts (Zod)     │
 │          ─ db.ts (Prisma Client)                                                    │
 └───────────────┬───────────────────────────────────────────────┬─────────────────────┘
                 │ Prisma (pooler 6543)                          │ HTTPS
                 ▼                                               ▼
     PostgreSQL / Supabase — schema `seo`, RLS bật        Claude API (Opus / Sonnet 5.5,
     Project · Keyword · Analysis · Cluster · Brief ·      web search, prompt caching)
     Article · ArticleRevision · Score · AiUsage
```

## 2. Luồng nghiệp vụ

```
Từ khoá ──► Phân tích (KeywordAnalysis) ──► Topic Cluster (ClusterMap) ──► Brief (ContentBrief)
                                                                              │
             Xuất md/html/JSON-LD ◄── Chấm điểm SEO/GEO (Score) ◄── Bài viết (Article + Revision)
```

| Bước | Trigger | Module | Lưu vào |
| --- | --- | --- | --- |
| Phân tích | `runAnalysis` (server action) | `lib/analyze.ts`: web search SERP → structured output | `Keyword`, `Analysis`, `AiUsage` |
| Cluster | `createCluster` | `lib/cluster.ts` + `lib/overlap.ts` (phát hiện trùng ý định) | `Cluster`, `Keyword` (source=cluster) |
| Sửa sơ đồ | `saveClusterMap` | `components/cluster/*` (React Flow) | `Cluster.data` (kèm vị trí, hướng LR/TB) |
| Brief | `createBrief` | `lib/brief.ts` | `Brief` |
| Viết bài | `POST /api/articles/[id]/write` (SSE) | `lib/writer.ts` — chế độ `write` · `fix` · `rewrite` | `Article`, `ArticleRevision` (bản trước khi AI sửa) |
| Chấm điểm | `POST /api/articles/[id]/score` | `lib/scorer.ts` — 23 rule + 8 tiêu chí AI | `Score` |
| Xuất | `GET /api/articles/[id]/export?format=md\|html\|jsonld` | `lib/markdown.ts`, `lib/jsonld.ts` | — |

## 3. Cấu trúc mã nguồn (`apps/web`)

```
src/
├── app/
│   ├── (home)/                       Trang chủ: danh sách + tạo dự án
│   ├── projects/[id]/
│   │   ├── (overview)/               Tổng quan dự án, form phân tích, lịch sử
│   │   ├── analyses/[analysisId]/    Kết quả phân tích (KPI, từ khoá, thực thể, SERP, GEO)
│   │   ├── clusters/(list) · [clusterId]/   Danh sách + editor sơ đồ cluster
│   │   ├── briefs/(list) · [briefId]/       Danh sách + chi tiết brief (outline rail)
│   │   └── articles/(list) · [articleId]/   Danh sách + editor bài viết
│   ├── usage/                        Chi phí AI
│   ├── api/                          Route handler (SSE, xuất file)
│   ├── actions.ts, article-actions.ts   Server actions
│   └── layout.tsx, error.tsx, not-found.tsx
├── components/
│   ├── ui/        Kit cơ bản: Button, Field, Badge, Chip, Panel, Table, Stat, Toast…
│   ├── shell/     Header, điều hướng, sub-nav tab dự án, skeleton
│   ├── nav/       NavProgress, PageToc, BackToTop
│   ├── content/   Bố cục trang chi tiết, KPI, copy chip, trạng thái chờ
│   ├── diagram/   Sơ đồ tĩnh (cây cluster trong trang phân tích)
│   ├── cluster/   Editor React Flow (node, cạnh, auto-layout)
│   └── article/   Editor bài viết, stream writer, panel điểm
├── lib/           Logic nghiệp vụ & AI (không phụ thuộc React)
└── styles/        Token AiDoIt + override + motion
```

**Quy ước route:** route group `(list)`, `(overview)`, `(home)` để mỗi nhóm có `loading.tsx` riêng; các layout "guard" gọi `notFound()` *ngoài* ranh giới loading để trang không tồn tại trả về **HTTP 404 thật**, không phải 200 + nội dung 404.

## 4. Quy ước kỹ thuật

- **Server-first:** truy vấn DB và gọi Claude chỉ ở server (server component, server action, route handler). Client component chỉ nhận dữ liệu đã chuẩn hoá.
- **Validate ở biên:** mọi input form qua Zod; mọi output AI qua `zodOutputFormat` (structured output). Không tin JSON chưa parse.
- **Tác vụ dài:** gọi Claude bằng `messages.stream(...).finalMessage()` (tránh timeout HTTP); viết bài stream trực tiếp ra trình duyệt bằng SSE, huỷ được bằng `AbortController`.
- **Chi phí là dữ liệu:** mỗi lời gọi Claude ghi một dòng `AiUsage` (`recordUsage`).
- **JSON lưu dạng text:** các payload AI (`Analysis.result`, `Cluster.data`, `Brief.data`, `Score.criteria`, `Article.jsonLd`) là chuỗi JSON đã validate. Lý do: giữ một schema chung cho mọi DB và đơn giản hoá migration. Có thể chuyển sang `jsonb` khi cần truy vấn bên trong.
- **Không hard-code màu:** chỉ dùng token (`npm run lint:tokens` chặn ở CI). Xem [Design system](design-system.md).
- **Ngôn ngữ:** UI và tài liệu tiếng Việt; tên biến, hàm, commit message tiếng Anh.

## 5. Bảo mật (tóm tắt)

- Khoá Claude và mật khẩu DB chỉ nằm trong biến môi trường server; không có `NEXT_PUBLIC_*` nhạy cảm.
- DB: schema riêng `seo`, RLS bật trên mọi bảng, không policy, thu hồi quyền `anon`/`authenticated` → Data API công khai của Supabase không đọc được gì ([ADR 0002](decisions/0002-postgres-supabase-rls.md)).
- **Chưa có đăng nhập** (giai đoạn tiếp theo): khi deploy công khai phải bật bảo vệ truy cập ở tầng hosting. Chi tiết: [SECURITY.md](../SECURITY.md), [Triển khai](deployment.md).

## 6. Hướng mở rộng đã lên kế hoạch

Auth + vai trò theo dự án (Supabase Auth) · giới hạn chi phí AI theo dự án · pgvector để phát hiện bài trùng ý định theo ngữ nghĩa · hàng đợi (pgmq) cho tác vụ AI dài · tích hợp WordPress/Google Docs. Xem [Kế hoạch sản phẩm](product/product-plan.md).
