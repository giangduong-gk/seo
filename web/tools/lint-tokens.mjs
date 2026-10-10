#!/usr/bin/env node
/**
 * Design-token lint: báo màu hard-code trong src/**\/*.{tsx,css}.
 *
 * - Bắt: #rgb / #rgba / #rrggbb / #rrggbbaa, rgb( / rgba( / hsl( / hsla(
 * - Bỏ qua: src/styles/tokens/** và src/styles/base.css (nơi định nghĩa token),
 *           phần nằm trong var(--token, fallback) (tham chiếu token là hợp lệ),
 *           dòng có chú thích `/* lint-allow-color *\/`.
 * - Exit code 1 nếu có vi phạm, 0 nếu sạch.  Dùng: node tools/lint-tokens.mjs [--json]
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const EXCLUDE = [path.join(SRC, "styles", "tokens") + path.sep, path.join(SRC, "styles", "base.css")];
const EXT = new Set([".tsx", ".css"]);
const ALLOW = "lint-allow-color";

// Hex 3–8 chữ số, không dính thêm hex phía sau, không nằm trong một từ (vd: &#x27;)
const HEX = /(?<![\w&])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![0-9a-z])/gi;
const FUNC = /\b(?:rgba?|hsla?)\(/gi;
const VAR_REF = /var\((?:[^()]|\([^()]*\))*\)/g; // var(--x) hoặc var(--x, fallback(...))

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else if (EXT.has(path.extname(p))) yield p;
  }
}

function isExcluded(p) {
  return EXCLUDE.some((e) => (e.endsWith(path.sep) ? p.startsWith(e) : p === e));
}

const findings = [];
for (const file of walk(SRC)) {
  if (isExcluded(file)) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((raw, i) => {
    if (raw.includes(ALLOW)) return;
    const line = raw.replace(VAR_REF, "var(…)");
    const hits = [...line.matchAll(HEX), ...line.matchAll(FUNC)].map((m) => m[0]);
    if (hits.length) findings.push({ file: path.relative(ROOT, file), line: i + 1, hits, text: raw.trim().slice(0, 140) });
  });
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(findings, null, 2));
} else if (findings.length) {
  console.error(`✖ lint:tokens — ${findings.length} dòng có màu hard-code (dùng token var(--…) hoặc thêm /* ${ALLOW} */):`);
  for (const f of findings) console.error(`  ${f.file}:${f.line}  ${f.hits.join(", ")}  │ ${f.text}`);
} else {
  console.log("✔ lint:tokens — không có màu hard-code ngoài src/styles/tokens.");
}
process.exit(findings.length ? 1 : 0);
