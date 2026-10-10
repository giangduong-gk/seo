import { execFileSync } from "node:child_process";
import path from "node:path";
import { E2E_DATABASE_URL } from "../../playwright.config";

/**
 * Chuẩn bị DB SQLite riêng cho e2e: prisma/test.db (đường dẫn tuyệt đối — xem playwright.config.ts).
 * 1. `prisma db push` — tạo file/đồng bộ schema (idempotent).
 * 2. `reset-db.mjs` — xoá dữ liệu cũ nhưng GIỮ NGUYÊN FILE: Playwright khởi động webServer TRƯỚC globalSetup,
 *    dev server có thể đã mở file; xoá file lúc này sẽ gây "attempt to write a readonly database" (SQLITE_READONLY_DBMOVED).
 * 3. `prisma/seed.mjs` — dữ liệu demo (demo-project / demo-cluster / demo-brief).
 * Biến môi trường truyền vào process con ghi đè .env (Prisma không override khoá đã có trong process.env).
 */
export default async function globalSetup() {
  const root = path.resolve(__dirname, "..", "..");
  const env = { ...process.env, DATABASE_URL: E2E_DATABASE_URL, ANTHROPIC_API_KEY: "" };
  const opts = { cwd: root, env, stdio: "inherit" as const };
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  execFileSync(npx, ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"], opts);
  execFileSync(process.execPath, ["tests/e2e/reset-db.mjs"], opts);
  execFileSync(process.execPath, ["prisma/seed.mjs"], opts);
}
