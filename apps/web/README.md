# rankmind-web

Ứng dụng web của **RankMind** (Next.js 15, App Router). Tài liệu đầy đủ nằm ở [`docs/`](../../docs/README.md) ở gốc repo.

```bash
npm ci                       # postinstall tự chạy prisma generate
cp .env.example .env         # điền ANTHROPIC_API_KEY, DATABASE_URL, DIRECT_URL
npm run db:migrate && npm run db:seed
npm run dev                  # http://localhost:3000
```

| Script | Tác dụng |
| --- | --- |
| `dev` / `build` / `start` | Phát triển / build / chạy production |
| `check` | `typecheck` + `test` + `lint:tokens` |
| `test` · `test:watch` | Vitest (`tests/unit`) |
| `test:e2e` · `test:e2e:ux` | Playwright: toàn bộ / chỉ UX gates |
| `ux:report` | Gộp kết quả UX gates thành bảng Markdown |
| `lint:tokens` | Chặn màu hard-code ngoài `src/styles/tokens` |
| `db:generate` · `db:migrate` · `db:migrate:dev` · `db:seed` | Prisma |

```
src/app/          route, server actions, API routes
src/components/   ui · shell · nav · content · diagram · cluster · article
src/lib/          pipeline AI (Claude), scorer, JSON-LD, Prisma client, schema Zod
src/styles/       token AiDoIt + override + motion
prisma/           schema, migrations, seed, fixtures, scripts/import-json.mjs
prompts/          standards-2026.md — system prompt SEO/GEO 2026
scripts/          lint-tokens.mjs, ux-report.mjs
tests/            unit (Vitest) · e2e (Playwright)
```

Xem: [Bắt đầu](../../docs/getting-started.md) · [Kiến trúc](../../docs/architecture.md) · [Kiểm thử](../../docs/testing.md).
