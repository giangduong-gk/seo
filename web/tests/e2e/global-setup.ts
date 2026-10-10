import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

/**
 * Tạo DB SQLite sạch cho e2e: prisma/test.db (Prisma resolve đường dẫn tương đối theo thư mục schema),
 * rồi seed dữ liệu demo (demo-project / demo-cluster / demo-brief) bằng prisma/seed.mjs.
 * Biến môi trường truyền vào process con ghi đè .env (Prisma không override khoá đã có trong process.env).
 */
export default async function globalSetup() {
  const root = path.resolve(__dirname, "..", "..");
  const env = { ...process.env, DATABASE_URL: "file:./test.db", ANTHROPIC_API_KEY: "" };
  for (const f of ["prisma/test.db", "prisma/test.db-journal", "prisma/test.db-wal", "prisma/test.db-shm"]) {
    const p = path.join(root, f);
    if (existsSync(p)) rmSync(p, { force: true });
  }
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  execFileSync(npx, ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"], { cwd: root, env, stdio: "inherit" });
  execFileSync(process.execPath, ["prisma/seed.mjs"], { cwd: root, env, stdio: "inherit" });
}
