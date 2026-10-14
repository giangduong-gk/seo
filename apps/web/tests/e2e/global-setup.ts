import { execFileSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { E2E_DATABASE_URL } from "../../playwright.config";
import { GOOD_ARTICLE, GOOD_KEYWORD, GOOD_META, GOOD_SLUG, GOOD_TITLE } from "../unit/fixtures/sample-article";
import { DEMO } from "./fixtures";

/**
 * Chuẩn bị DB Postgres riêng cho e2e (`seo_test`, schema `seo` — xem playwright.config.ts).
 * 1. `prisma migrate deploy` — áp đúng các migration trong prisma/migrations (giống production/Supabase, idempotent).
 * 2. `reset-db.mjs` — xoá dữ liệu cũ (giữ schema; dev server có thể đã kết nối vì Playwright khởi động webServer TRƯỚC globalSetup).
 * 3. `prisma/seed.mjs` — dữ liệu demo (demo-project / demo-cluster / demo-brief).
 * 4. Bổ sung cho bộ UX gate: bài viết `demo-article` (nội dung dài từ fixture unit) để có trang editor bài viết,
 *    và đưa id phân tích seed (cuid ngẫu nhiên) vào `process.env.E2E_ANALYSIS_ID` — worker kế thừa env của globalSetup.
 * Biến môi trường truyền vào process con ghi đè .env (Prisma không override khoá đã có trong process.env).
 */
export default async function globalSetup() {
  const root = path.resolve(__dirname, "..", "..");
  const env = { ...process.env, DATABASE_URL: E2E_DATABASE_URL, DIRECT_URL: E2E_DATABASE_URL, ANTHROPIC_API_KEY: "" };
  const opts = { cwd: root, env, stdio: "inherit" as const };
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  execFileSync(npx, ["prisma", "migrate", "deploy"], opts);
  execFileSync(process.execPath, ["tests/e2e/reset-db.mjs"], opts);
  execFileSync(process.execPath, ["prisma/seed.mjs"], opts);

  // Ảnh trong bài mẫu trỏ /images/… (không có trong public/) → thay bằng SVG data URI để preview không sinh 404 console.error.
  const pixel = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='450'/%3E";
  const body = GOOD_ARTICLE.replace(/\]\(\/images\/[^)]+\)/g, `](${pixel})`);
  const prisma = new PrismaClient({ datasources: { db: { url: E2E_DATABASE_URL } } });
  try {
    await prisma.article.create({
      data: {
        id: DEMO.articleId, projectId: DEMO.projectId, briefId: DEMO.briefId, targetKeyword: GOOD_KEYWORD, title: GOOD_TITLE,
        slug: GOOD_SLUG, metaDescription: GOOD_META, bodyMarkdown: body, status: "review", model: "claude-opus-5-5",
      },
    });
    const analysis = await prisma.analysis.findFirst({ where: { projectId: DEMO.projectId }, select: { id: true } });
    if (analysis) process.env.E2E_ANALYSIS_ID = analysis.id;
  } finally {
    await prisma.$disconnect();
  }
}
