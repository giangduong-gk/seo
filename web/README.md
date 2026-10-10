# SEO Studio — web

Next.js 15 + TypeScript · Anthropic SDK · Prisma (SQLite dev) · AiDoIt Design System tokens.

## Chạy local
```bash
cd web
cp .env.example .env        # điền ANTHROPIC_API_KEY
npm install
npx prisma db push          # tạo prisma/dev.db
npm run dev                 # http://localhost:3000
```

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
