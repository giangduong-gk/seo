# TESTING — QA/QC cho SEO Studio

Tài liệu này mô tả hạ tầng kiểm thử (unit · e2e · lint token), phạm vi đã phủ, checklist QA thủ công cho Sprint 1–3 và các khoảng trống đã biết.

## 1. Chạy nhanh

```bash
cd web
npm ci && npx prisma generate

npm run typecheck     # tsc --noEmit (bao gồm cả tests/)
npm test              # Vitest — unit tests trong tests/unit/**
npm run test:watch    # Vitest watch
npm run test:e2e      # Playwright — dev server riêng cổng 3500, DB prisma/test.db, KHÔNG có API key
npm run lint:tokens   # báo màu hard-code ngoài src/styles/tokens (exit 1 nếu có)
```

CI (`.github/workflows/ci.yml`): Node 22 → `npm ci` → `prisma generate` → `typecheck` → `npm test` → `npm run build` → `lint:tokens` (chỉ báo, `continue-on-error`) → job e2e cài Chromium bằng `npx playwright install --with-deps chromium` rồi `npm run test:e2e`. Khi fail, report/trace được upload làm artifact `playwright-report`.

## 2. Unit tests (Vitest)

Cấu hình: `vitest.config.mts` (environment `node`, alias `@` → `./src`, include `tests/unit/**/*.test.ts`, coverage v8 cho `src/lib/**`).

| File | Module | Nội dung chính |
| --- | --- | --- |
| `tests/unit/overlap.test.ts` | `src/lib/overlap.ts` | Jaccard + stop-word, cùng ý định, ngưỡng, sắp xếp, chuẩn hoá |
| `tests/unit/markdown.test.ts` | `src/lib/markdown.ts` | extractHeadings (bỏ code fence), stripMarkdown, wordCount, slugify (tiếng Việt, đ→d, cắt 80), splitSections, parseFaq (H3 + in đậm, bỏ `Q:`), renderMarkdown (GFM), firstParagraph |
| `tests/unit/brief-markdown.test.ts` | `src/lib/brief.ts → briefToMarkdown` | Cấu trúc file .md xuất ra từ fixture `sample-brief.json` |
| `tests/unit/schemas-fixtures.test.ts` | `src/lib/schemas.ts` | 3 fixture seed phải hợp lệ (`KeywordAnalysis`, `ClusterMap`, `ContentBrief`), bất biến (1 pillar, link trỏ node tồn tại…), schema từ chối dữ liệu sai |
| `tests/unit/cost.test.ts` | `src/lib/claude.ts → estimateCostUsd` | Bảng giá/1M token, cache read/write, model lạ → giá opus |
| `tests/unit/prompts.test.ts` | `src/lib/prompts.ts` | `projectProfilePrompt` đầy đủ/tối thiểu/null, `standards2026()` đọc file + cache |
| `tests/unit/scorer.test.ts` | `src/lib/scorer.ts` | 23 rule id theo contract, shape `ScoreCriterion`, bài mẫu chuẩn (~900 từ, `tests/unit/fixtures/sample-article.ts`) → pass, bài xấu → fail đúng id, `computeScores` tính tay |
| `tests/unit/jsonld.test.ts` | `src/lib/jsonld.ts` | `Article` (headline, ngày ISO), `FAQPage` chỉ khi ≥ 2 FAQ, `BreadcrumbList` chỉ khi có domain, author/publisher từ entityProfile, `jsonLdScriptTag` JSON hợp lệ + escape `</script>` |

Module Sprint 3 (`scorer.ts`, `jsonld.ts`) được import qua `tests/unit/_helpers.ts → importIfExists()`: nếu file chưa tồn tại thì `describe.skip` với lý do rõ ràng thay vì làm fail cả suite; nếu file tồn tại nhưng import lỗi thì vẫn fail (bug thật).

## 3. E2E smoke (Playwright Test)

Cấu hình: `playwright.config.ts`
- `webServer`: `npm run dev -- -p 3500`, `reuseExistingServer: true`, timeout 180 s, env `DATABASE_URL=file:<abs>/web/prisma/test.db` (hằng `E2E_DATABASE_URL` trong config), `ANTHROPIC_API_KEY=""`.
- `globalSetup` (`tests/e2e/global-setup.ts`): `prisma db push --skip-generate` (tạo file nếu chưa có) → `tests/e2e/reset-db.mjs` (xoá dữ liệu, **giữ nguyên file**) → `node prisma/seed.mjs` — cùng env.
  Không xoá file DB vì Playwright khởi động `webServer` *trước* `globalSetup`: server đã mở file, xoá/tạo lại sẽ gây `SQLITE_READONLY_DBMOVED` ("attempt to write a readonly database").
- 2 project: `chromium` (Desktop Chrome) và `phone` (390×844, isMobile, touch, UA iPhone 13 — chạy bằng Chromium, không tải WebKit).
- Chromium: dùng `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` nếu tồn tại (hoặc `PW_CHROME_PATH`), ngược lại dùng browser Playwright cài (CI).
- Fixture `tests/e2e/fixtures.ts` tự động cho mọi test: gom `pageerror` + `console.error` (bỏ qua favicon/React DevTools), sau mỗi test kiểm tra không lỗi và `document.documentElement.scrollWidth <= innerWidth`.

**Ghi chú env đã kiểm chứng**
- `@next/env` chụp `process.env` lúc khởi động và **không cho `.env` ghi đè khoá đã có** — kể cả giá trị rỗng. Vì vậy `ANTHROPIC_API_KEY=""` truyền qua `webServer.env` thắng khoá thật trong `web/.env` → UI hiện thông báo vàng, nút sinh nội dung bị vô hiệu, không có cuộc gọi Claude nào.
- Prisma CLI/Client cũng ưu tiên `process.env`; `dev.db` không bị động tới.
- **Dùng đường dẫn tuyệt đối cho DB e2e.** Client Prisma resolve `file:./x.db` theo thư mục schema được "nướng" vào `node_modules/.prisma` lúc `prisma generate`. Trong sprint này đã gặp sự cố: một bản copy của dự án (`…/scratchpad/webbuild`, `node_modules` là symlink về `web/node_modules`) chạy `prisma generate` → mọi `file:./…` trong `web` trỏ sang `webbuild/prisma/…` ("table Project does not exist"). Khắc phục: `cd web && npx prisma generate`; e2e không còn bị ảnh hưởng vì dùng đường dẫn tuyệt đối, nhưng `dev.db` của server dev (`file:./dev.db`) vẫn có thể bị lệch — không `prisma generate` từ bản copy dùng chung `node_modules`.
- Nếu đã có server khác ở cổng 3500 (`reuseExistingServer`), test sẽ dùng DB của server đó — hãy tắt nó hoặc đặt `E2E_PORT`.

| Spec | Kiểm tra |
| --- | --- |
| `home.spec.ts` | Wordmark **SEO** Studio, danh sách dự án seed, thông báo API key; tạo dự án qua form → trang dự án; validate tên ngắn |
| `project.spec.ts` | Header/sub-nav, form phân tích bị vô hiệu, lịch sử phân tích; trang phân tích: 4 KPI panel, ≥ 5 chip, bảng thực thể, checklist GEO; 404 |
| `clusters.spec.ts` | Danh sách cluster + cannibalization; editor `.react-flow__node` ≥ 5, `.react-flow__edge` ≥ 5; chọn node → panel thuộc tính; sửa → "Chưa lưu thay đổi" (desktop) |
| `briefs.spec.ts` | Danh sách brief; trang brief (outline, E-E-A-T, schema, FAQ, link tải .md); API `/api/briefs/demo-brief/markdown` → `# Content Brief`, `?download=1`, 404 |
| `usage.spec.ts` | Trang Chi phí AI: KPI + 2 bảng |
| `articles.spec.ts` | Sprint 3 — skip nếu route 404: danh sách bài viết, form bị vô hiệu, 404 bài không tồn tại |
| `layout.spec.ts` | Quét mọi route (cả 2 project): status 200, có H1, không lỗi, không tràn ngang |

## 4. Lint design token

`tools/lint-tokens.mjs` quét `src/**/*.{tsx,css}` (trừ `src/styles/tokens/**`, `src/styles/base.css`) tìm `#hex`, `rgb(`, `rgba(`, `hsl(`, `hsla(` nằm ngoài `var(--…)`. Cho phép bằng chú thích `/* lint-allow-color */` trên cùng dòng. `--json` để xuất máy đọc.

### Kết quả hiện tại (2026-10-10)

Lần quét đầu tiên phát hiện 6 dòng màu hard-code (không thuộc QA):
`ClusterEditor.module.css:17` (rgba volt), `ClusterEditor.tsx:160` (React Flow `<Background color>`), `ClusterEditor.tsx:162` (MiniMap `#FFEA00`/`#6E737A`/rgba),
`Badge.module.css:3` (`#fff`), `Chip.module.css:3` (rgba volt), `Progress.module.css:3` (rgba trắng).
Team UI đã xử lý ngay trong sprint (commit "Token lint clean"): Badge/Progress chuyển sang token (`var(--on-media)`, token state),
4 vị trí còn lại là màu truyền vào React Flow/viền volt mờ và được đánh dấu `/* lint-allow-color */` kèm lý do. **`npm run lint:tokens` hiện exit 0.**
Khi lint đã sạch ổn định, bỏ `continue-on-error` trong CI để lint chặn merge.

## 5. Checklist QA thủ công

### Sprint 1 — Dự án & phân tích từ khoá
- [ ] Tạo dự án với đầy đủ thực thể (tổ chức, sản phẩm, tác giả, sameAs); kiểm tra `entityProfile` hiển thị đúng trong prompt (hồ sơ dự án).
- [ ] Không có API key: thông báo vàng ở mọi trang, nút Phân tích/Tạo cluster/Tạo brief/Viết bài bị vô hiệu.
- [ ] Có API key: phân tích một từ khoá tiếng Việt (1–3 phút); trang kết quả có ý định + độ tin cậy, KPI, từ khoá theo vai trò, thực thể, SERP, gợi ý cluster, checklist GEO, FAQ.
- [ ] Phân tích thất bại/refusal → bản ghi trạng thái `failed`/`refused` xuất hiện trong lịch sử với badge đỏ, có thông báo lỗi dễ hiểu.
- [ ] Trang `/usage` cộng dồn chi phí đúng theo bảng giá; tỷ lệ cache hit tăng sau lần gọi thứ 2 cùng dự án.

### Sprint 2 — Topic Cluster & Content Brief
- [ ] Chọn ≥ 2 từ khoá (hoặc nhập thêm) → sinh cluster; map có đúng 1 pillar, 4–8 cluster, cảnh báo cannibalization (rule engine) hiển thị.
- [ ] Editor: kéo node → vị trí được lưu sau khi bấm Lưu và tải lại trang; kéo từ chấm dưới node sang node khác tạo edge; sửa anchor; xoá edge; xoá node (không xoá được pillar); thêm cluster/supporting.
- [ ] Sửa tiêu đề pillar/strategy → trạng thái "Chưa lưu thay đổi" → Lưu → "Đã lưu"; dữ liệu hợp lệ theo `ClusterMap` (lỗi schema hiện ra nếu sai).
- [ ] Tạo brief từ node trong cluster → brief gắn `clusterId`, có internal link tới các bài anh em.
- [ ] Trang brief: outline bắt đầu H1, answer-first mỗi H2/H3, E-E-A-T, checklist GEO, schema plan, multi-format, FAQ, doNot.
- [ ] Copy Markdown (clipboard) và Tải .md (`Content-Disposition: attachment`); nội dung `.md` khớp `briefToMarkdown`.
- [ ] Responsive 390 px: không tràn ngang; bảng cuộn trong panel; React Flow dùng được bằng cảm ứng.

### Sprint 3 — Viết bài, chấm điểm, sửa, xuất
- [ ] Viết bài từ brief: stream SSE hiển thị dần (`delta`), kết thúc bằng `done` với số từ; lỗi/refusal hiện `error` có thông điệp.
- [ ] Bài lưu `bodyMarkdown`, `slug` (slugify), `metaDescription`; trạng thái chuyển `draft → writing → review → final` đúng chỗ.
- [ ] Chấm điểm: rule engine (23 tiêu chí) chạy không tốn token; chấm AI (8 tiêu chí GEO/E-E-A-T) chỉ khi có API key; `seoScore`/`geoScore` 0–100 khớp `computeScores`.
- [ ] Mỗi tiêu chí chưa đạt có `fix` cụ thể; nút "Sửa theo gợi ý" gửi `fix` cho Writer (mode `fix`) và tạo `ArticleRevision` kèm `note`.
- [ ] Rewrite toàn bài giữ nguyên slug/từ khoá; lịch sử revision xem/khôi phục được.
- [ ] JSON-LD sinh bằng code: `Article` luôn có; `FAQPage` chỉ khi ≥ 2 FAQ; `BreadcrumbList` khi có domain; thẻ `<script type="application/ld+json">` dán vào `<head>` không vỡ HTML.
- [ ] Export: `/api/articles/[id]/export` trả Markdown/HTML + JSON-LD; mở file xuất trong trình duyệt render đúng heading/bảng/FAQ.
- [ ] Không có API key: trang bài viết vẫn mở được, nút Viết/Chấm AI bị vô hiệu, rule score vẫn tính được.

## 6. Khoảng trống đã biết
- Chưa có test cho đường đi gọi Claude thật (`analyze.ts`, `cluster.ts`, `generateBrief`, `writer.ts`, `runAiChecks`) — cần mock SDK hoặc fixture ghi lại; hiện chỉ test phần thuần hàm.
- E2E không kiểm tra stream SSE của Writer và luồng sửa/chấm AI (cần API key hoặc server mock).
- Server actions (`actions.ts`, `article-actions.ts`) chưa có test tích hợp với Prisma (có thể chạy trên `test.db` trong tương lai).
- E2E dùng dev server (biên dịch chậm, có thể flaky lần đầu); CI nên cân nhắc `next build && next start -p 3500` để ổn định hơn.
- `lint:tokens` hiện chỉ báo cáo (`continue-on-error`) cho tới khi team UI sửa 6 vi phạm ở mục 4.
