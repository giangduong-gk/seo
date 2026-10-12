# TESTING — QA/QC cho SEO Studio

Tài liệu này mô tả hạ tầng kiểm thử (unit · e2e · lint token), phạm vi đã phủ, checklist QA thủ công cho Sprint 1–3 và các khoảng trống đã biết.

## 1. Chạy nhanh

```bash
cd web
npm ci && npx prisma generate
# e2e cần Postgres cục bộ có database `seo_test` (mặc định postgresql://seo:seo@localhost:5432/seo_test?schema=seo, đổi bằng E2E_DATABASE_URL)

npm run typecheck     # tsc --noEmit (bao gồm cả tests/)
npm test              # Vitest — unit tests trong tests/unit/**
npm run test:watch    # Vitest watch
npm run test:e2e      # Playwright — TẤT CẢ spec (smoke + UX gate); dev server riêng cổng 3500, distDir .next-qa, DB Postgres `seo_test`, KHÔNG có API key
npm run test:e2e:ux   # chỉ 5 bộ UX gate (a11y · layout · motion · keyboard · visual)
npm run ux:report     # gộp test-results/ux-report/*.json → bảng Markdown trang × check (stdout; thêm đường dẫn để ghi file)
npm run lint:tokens   # báo màu hard-code ngoài src/styles/tokens (exit 1 nếu có)

# chạy MỘT bộ / một trang / một project
npx playwright test tests/e2e/a11y.spec.ts
npx playwright test tests/e2e/layout.spec.ts -g "1440px"          # một viewport
npx playwright test tests/e2e/layout.spec.ts -g "Brief" --project=chromium
npx playwright test tests/e2e/layout.spec.ts --project=phone      # chỉ kiểm tra vùng chạm
npx playwright show-report                                        # (CI) xem HTML report + ảnh/JSON đính kèm
```

CI (`.github/workflows/ci.yml`): service `postgres:16` (database `seo_test`) cho job e2e; Node 22 → `npm ci` → `prisma generate` → `typecheck` → `npm test` → `npm run build` → `lint:tokens` (bắt buộc) → job e2e (timeout 50 phút) `npm ci` (cài cả `@axe-core/playwright` ghim trong lockfile) → cài Chromium bằng `npx playwright install --with-deps chromium` → `npm run test:e2e` (mọi spec, gồm UX gate) → **luôn** chạy `tools/ux-report.mjs` và ghi bảng trang × check vào Job Summary → **luôn** upload `playwright-report` + `test-results` (ảnh baseline `test-results/visual/`, `ux-report/*.json`, trace khi fail).

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
- `webServer`: `npm run dev -- -p 3500`, `reuseExistingServer: true`, timeout 180 s, env `NEXT_DIST_DIR=.next-qa` (đổi bằng `E2E_DIST_DIR`), `DATABASE_URL`/`DIRECT_URL` = Postgres `seo_test` schema `seo` (hằng `E2E_DATABASE_URL` trong config, đổi bằng biến cùng tên), `ANTHROPIC_API_KEY=""`.
  `next.config.ts` đọc `distDir` từ `NEXT_DIST_DIR` → nhiều dev server chạy song song trên cùng repo không ghi đè `.next` của nhau (các nhánh UI dùng `.next-b1/.next-b2/.next-c` ở cổng 3401–3403; e2e luôn là `.next-qa` ở 3500). Lưu ý: `next dev` tự thêm `<distDir>/types/**/*.ts` vào `tsconfig.json#include`.
- `globalSetup` (`tests/e2e/global-setup.ts`): `prisma migrate deploy` (đúng các migration sẽ chạy trên Supabase, gồm RLS) → `tests/e2e/reset-db.mjs` (xoá dữ liệu; **từ chối chạy** nếu `DATABASE_URL` không trỏ vào database `seo_test`) → `node prisma/seed.mjs` → tạo bài viết `demo-article` (nội dung ~900 từ từ `tests/unit/fixtures/sample-article.ts`, ảnh thay bằng SVG data URI) để có trang editor bài viết, và đặt `process.env.E2E_ANALYSIS_ID` (id phân tích seed là cuid ngẫu nhiên) cho worker — cùng env.
- 2 project: `chromium` (Desktop Chrome) và `phone` (390×844, isMobile, touch, UA iPhone 13 — chạy bằng Chromium, không tải WebKit).
- Chromium: dùng `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` nếu tồn tại (hoặc `PW_CHROME_PATH`), ngược lại dùng browser Playwright cài (CI).
- Fixture `tests/e2e/fixtures.ts` tự động cho mọi test: gom `pageerror` + `console.error` (bỏ qua favicon/React DevTools), sau mỗi test kiểm tra không lỗi và `document.documentElement.scrollWidth <= innerWidth`.

**Ghi chú env đã kiểm chứng**
- `@next/env` chụp `process.env` lúc khởi động và **không cho `.env` ghi đè khoá đã có** — kể cả giá trị rỗng. Vì vậy `ANTHROPIC_API_KEY=""` truyền qua `webServer.env` thắng khoá thật trong `web/.env` → UI hiện thông báo vàng, nút sinh nội dung bị vô hiệu, không có cuộc gọi Claude nào.
- Prisma CLI/Client cũng ưu tiên `process.env`; database dev (`seo_dev`) không bị động tới.
- Nếu đã có server khác ở cổng 3500 (`reuseExistingServer`), test sẽ dùng DB của server đó — hãy tắt nó hoặc đặt `E2E_PORT`.

| Spec | Kiểm tra |
| --- | --- |
| `home.spec.ts` | Wordmark **SEO** Studio, danh sách dự án seed, thông báo API key; tạo dự án qua form → trang dự án; validate tên ngắn |
| `project.spec.ts` | Header/sub-nav, form phân tích bị vô hiệu, lịch sử phân tích; trang phân tích: hàng KPI "Tổng quan" (Ý định · Khối lượng · Độ khó · Nguồn dữ liệu), panel "Ý định & góc viết" (Định dạng đề xuất, Đối tượng), ≥ 5 chip, thực thể (bảng trên desktop / danh sách thẻ trên phone), checklist GEO; 404 thật |
| `clusters.spec.ts` | Danh sách cluster + cannibalization; editor `.react-flow__node` ≥ 5, `.react-flow__edge` ≥ 5; chọn node → panel thuộc tính; sửa → "Chưa lưu thay đổi" (desktop) |
| `briefs.spec.ts` | Danh sách brief; trang brief (panel `section#outline` — region tên "Outline" đang trùng với ô KPI, bắt bởi gate landmark trong a11y.spec — E-E-A-T, schema, FAQ, link tải .md); API `/api/briefs/demo-brief/markdown` → `# Content Brief`, `?download=1`, 404 |
| `usage.spec.ts` | Trang Chi phí AI: 4 ô KPI `<Stat>` trong `.grid-kpi` (tổng chi phí, lần gọi, token, cache hit), biểu đồ "Chi phí theo tính năng", 2 bảng (nhãn tính năng đã Việt hoá: "Phân tích từ khoá") |
| `articles.spec.ts` | Sprint 3 — skip nếu route 404: danh sách bài viết, form bị vô hiệu, 404 bài không tồn tại |
| `a11y.spec.ts` | **UX gate** — axe-core WCAG 2.0 A/AA + 2.1 AA, 10 trang × 2 project; tên landmark duy nhất (xem mục 3a) |
| `layout.spec.ts` | **UX gate** — 10 trang × 4 viewport (360/768/1024/1440): status 200, có H1, tràn ngang trang/phần tử, H1 bị cắt, sticky đè heading, CLS; vùng chạm trên phone (mục 3a) |
| `motion.spec.ts` | **UX gate** — reduced-motion, smooth scroll, TOC neo dưới header, NavProgress, BackToTop, vùng toast |
| `keyboard.spec.ts` | **UX gate** — Tab đầu tiên tới skip link/nav, focus nhìn thấy, Escape đóng menu, Ctrl+S trong editor |
| `visual.spec.ts` | Ảnh full-page 10 trang ở 1440 (chromium) và 390 (phone) → `test-results/visual/*.png` + attachment (không so snapshot) |

## 3a. UX quality gates

Hạ tầng chung `tests/e2e/ux.ts`: `UX_PAGES` (10 trang: trang chủ, dự án, phân tích, DS cluster, editor cluster, DS brief, brief, DS bài viết, editor bài viết, chi phí AI), `settle()` (load → networkidle ≤ 10 s → `document.fonts.ready` → animation hữu hạn trên DocumentTimeline xong, ≤ 3 s), `installUxHelpers()` (tiêm `window.__ux`: selector dễ đọc — class CSS-module rút gọn `Shell-module__x__header` → `Shell__header`, đoạn text, kiểm tra hiển thị, nhận diện bên thứ ba `.react-flow`/`nextjs-portal`) và `recordUx()` (ghi `test-results/ux-report/<suite>__<trang>__<biến thể>.json` + attachment). `npm run ux:report [file.md]` gộp thành bảng trang × check kèm selector/đoạn text vi phạm.

| Bộ | Check | Ngưỡng | Vì sao |
| --- | --- | --- | --- |
| a11y | axe `wcag2a`, `wcag2aa`, `wcag21aa` | **fail** khi `serious`/`critical`; `moderate`/`minor` chỉ log + ghi báo cáo | serious/critical chặn người dùng thật (tương phản, nhãn thiếu, ARIA sai); moderate thường là vấn đề cấu trúc nên sửa dần. Chạy với reduced-motion để animation vào trang không làm sai phép đo tương phản. Báo cáo axe đầy đủ: attachment `axe-<trang>-<project>.json`. |
| a11y | loại trừ | `nextjs-portal`, `.react-flow__minimap`, `.react-flow__attribution` | overlay dev của Next (không có ở production) và markup nội bộ @xyflow/react mà app không kiểm soát; node/edge/controls React Flow vẫn được quét |
| a11y | dương tính giả axe đã kiểm chứng | bỏ node `scrollable-region-focusable` nằm trong `fieldset[disabled]` **và** `el.focus()` thành công (ghi vào `info.axeFalsePositivesIgnored`) | axe-core 4.13 `focusDisabled()` coi mọi hậu duệ fieldset bị khoá là không focus được, nhưng trình duyệt vẫn focus `div[tabindex=0]` (vd. `.ClusterForm_list` khi form khoá vì thiếu API key) |
| a11y | tên landmark duy nhất (chromium) | không có hai `section/nav/aside/form/[role=region…]` cùng role + cùng tên hiển thị | axe `landmark-unique` thuộc best-practice nên không nằm trong bộ tag WCAG; hai region trùng tên khiến danh sách landmark của trình đọc màn hình mơ hồ |
| layout (a) | tràn ngang trang | `scrollWidth ≤ innerWidth` | cuộn ngang toàn trang là lỗi bố cục rõ nhất trên mobile; báo phần tử ngoài cùng lòi khỏi viewport |
| layout (b) | phần tử tràn hộp | `scrollWidth ≤ clientWidth + 1` trừ `overflow-x: auto/scroll`, `text-overflow: ellipsis`, sr-only, React Flow; chỉ tính tràn do con **trong luồng** hoặc text (bỏ qua trang trí `position:absolute` như mũi tên `::after`); báo phần tử sâu nhất + con gây tràn | bắt nút/nhãn/bảng bị đẩy ra ngoài card trước khi nó thành tràn trang |
| layout (c) | H1 bị cắt | không ellipsis / line-clamp nào thực sự cắt chữ trong `h1` | tiêu đề trang phải đọc được đầy đủ |
| layout (d) | sticky | sau tải: sticky/fixed (cao > 3 px) không giao heading đầu tiên của `<main>`; cuộn giữa trang: các sticky ở nửa trên không chồng nhau | header + sub-nav + dải TOC + toolbar xếp chồng phải khớp `--header-offset`/`--subnav-h` |
| layout (e) | CLS | **< 0.1** (cửa sổ phiên lớn nhất kiểu web-vitals, `PerformanceObserver({type:'layout-shift', buffered:true})` sau load + 1 s) | ngưỡng "Good" của Core Web Vitals; báo nguồn dịch chuyển |
| layout (f) | vùng chạm (project phone 390×844, `hasTouch`) | **≥ 40×40 px** cho `button`, `a[href]`, `[role=button]`, `input[type=checkbox]` trong `<main>`; miễn `p a` (link trong đoạn văn) và React Flow; vùng nới bằng `::before`/`<label>` được tính (thử `elementFromPoint` 4 điểm quanh tâm) | gần mức 44 px của Apple/WCAG 2.5.5 nhưng chừa chỗ cho nút compact 40 px của DS; WCAG 2.5.8 miễn link trong câu |
| motion | reduced-motion | không animation **hữu hạn** đang chạy sau load (lấy mẫu lúc load và +300 ms); bỏ qua vô hạn (skeleton/spinner), transition ≤ 10 ms (reset `0.01ms` chuẩn) và overlay dev; `html` không `scroll-behavior: smooth` | tôn trọng `prefers-reduced-motion` |
| motion | smooth scroll / TOC | không reduce → `scroll-behavior: smooth`; bấm mục 3 và mục cuối của TOC (`nav[aria-label]`/`[role=navigation][aria-label]` có `a[href^="#"]`) ở 1440 và 390 → `top(section) ≥ đáy sticky ngang ở mép trên − 2 px`; **skip** khi trang chưa có TOC | neo không bị header/sub-nav/dải TOC che (`scroll-margin-top`) |
| motion | NavProgress / BackToTop / Toast | thanh fixed ≤ 3 px ở đỉnh xuất hiện khi bấm link sub-nav và biến mất ≤ 5 s sau điều hướng; BackToTop ẩn ở đầu trang, hiện sau cuộn 2 màn hình, bấm → `scrollY < 5`; `[role=region][aria-label="Thông báo"]` có `aria-live` | phản hồi điều hướng và quay lại đầu trang trên trang dài |
| keyboard | Tab đầu tiên | skip link (`a[href^="#"]` trỏ id tồn tại) hoặc phần tử trong `header`/`nav` | người dùng bàn phím không phải Tab qua nội dung trước khi tới điều hướng |
| keyboard | focus visible | tối đa 40 tab stop; phần tử focus có `outline` (≠ none, width > 0) hoặc `box-shadow` ≠ none, hoặc cha đổi style khi focus (`:focus-within`) | WCAG 2.4.7 |
| keyboard | Escape | `[aria-expanded]` toggle và `<details>` dạng dropdown (con `position: absolute/fixed`) phải đóng bằng Escape; `<details>` accordion thường chỉ ghi info | WAI-ARIA: menu/popup đóng bằng Escape; disclosure không bắt buộc |
| keyboard | Ctrl+S | editor bài viết: sửa tiêu đề → "Chưa lưu thay đổi" → Ctrl+S → "Đã lưu" (rồi trả lại tiêu đề gốc); editor cluster: skip nếu chưa hỗ trợ | phím tắt lưu quen thuộc |
| visual | ảnh | không assertion | UI đang redesign — người review bằng mắt; chuyển sang `toHaveScreenshot` khi UI ổn định |

Baseline lần đầu (trước khi redesign xong): xem `scratchpad/ux/qa-baseline.md` của phiên QA; tái tạo bằng `npm run test:e2e:ux; npm run ux:report baseline.md`.

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
- Server actions (`actions.ts`, `article-actions.ts`) chưa có test tích hợp với Prisma (có thể chạy trên database `seo_test` trong tương lai).
- E2E dùng dev server (biên dịch chậm, có thể flaky lần đầu); CI nên cân nhắc `next build && next start -p 3500` để ổn định hơn.
- UX gate chưa tự động hoá: độ "mượt" cảm nhận của animation (easing/thời lượng chỉ đo gián tiếp qua token), tỉ lệ/khoảng trắng "hợp lý" (cần review ảnh `test-results/visual/`), kéo-thả/pinch trên React Flow bằng cảm ứng, đọc bằng screen reader thật (axe chỉ kiểm tra tĩnh), hiệu năng cuộn (FPS/long task) và CLS khi tương tác (chỉ đo lúc tải).
- Vùng chạm trong React Flow (handle 6–8 px) được miễn vì là của thư viện — trên điện thoại vẫn khó kéo edge.
