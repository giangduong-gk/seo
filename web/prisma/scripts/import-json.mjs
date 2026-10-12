// Nhập dữ liệu đã xuất (JSON) vào database hiện tại (DATABASE_URL), giữ nguyên id và thời gian.
// Dùng một lần khi chuyển từ SQLite sang Postgres: node prisma/scripts/import-json.mjs export.json
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) { console.error("Cách dùng: node prisma/scripts/import-json.mjs <export.json>"); process.exit(1); }
const data = JSON.parse(readFileSync(file, "utf8"));
const prisma = new PrismaClient();
const DATE_KEYS = ["createdAt", "updatedAt"];
const fix = (rows) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, DATE_KEYS.includes(k) && v ? new Date(v) : v])));
// thứ tự theo khoá ngoại
const ORDER = ["project", "keyword", "analysis", "cluster", "brief", "article", "articleRevision", "score", "aiUsage"];
for (const m of ORDER) {
  const rows = fix(data[m] ?? []);
  if (!rows.length) continue;
  const r = await prisma[m].createMany({ data: rows, skipDuplicates: true });
  console.log(m.padEnd(16), `${r.count}/${rows.length}`);
}
await prisma.$disconnect();
