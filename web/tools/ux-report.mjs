#!/usr/bin/env node
// Gộp kết quả UX gate (test-results/ux-report/*.json, do tests/e2e/ux.ts → recordUx ghi) thành bảng Markdown trang × check.
// Dùng: node tools/ux-report.mjs [out.md] [--dir test-results/ux-report] [--max 6]
// Không có out.md → in ra stdout.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : def; };
const dir = path.resolve(opt("--dir", path.join(import.meta.dirname, "..", "test-results", "ux-report")));
const MAX = Number(opt("--max", 6));
const out = args[0];

if (!existsSync(dir)) { console.error(`Không có ${dir} — chạy npm run test:e2e trước.`); process.exit(1); }
const recs = readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")));

const PAGE_ORDER = ["home", "project", "analysis", "clusters", "cluster-editor", "briefs", "brief", "articles", "article-editor", "usage"];
const pageIdx = (k) => { const i = PAGE_ORDER.indexOf(k); return i < 0 ? 99 : i; };
const pageName = new Map(recs.map((r) => [r.page, r.pageName]));
const esc = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
const fmtItem = (it) => {
  if (typeof it === "string") return it;
  if (it && typeof it === "object") {
    if ("culprits" in it) return `scrollWidth ${it.scrollWidth} > ${it.innerWidth}; thủ phạm: ${it.culprits.map((c) => `\`${c.sel}\` "${c.text}" [${c.left}→${c.right}]`).join("; ")}`;
    if ("nodes" in it) return `[${it.impact}] **${it.id}** ×${it.count} — ${it.help}: ${it.nodes.slice(0, 3).map((n) => `\`${n.target}\``).join(", ")}`;
    if ("sel" in it && "kind" in it) return `\`${it.sel}\` ${it.kind} ${it.scrollWidth}>${it.clientWidth}px "${it.text}"${it.child ? ` ← con \`${it.child}\`` : ""}`;
    if ("sel" in it && "w" in it) return `\`${it.sel}\` "${it.text}" ${it.w}×${it.h}`;
    if ("sticky" in it) return `sticky \`${it.sticky}\` đè heading "${it.heading}" ${it.overlapPx}px`;
    if ("a" in it && "b" in it) return `\`${it.a}\` chồng \`${it.b}\` ${it.overlapPx}px`;
    if ("cls" in it) return `CLS ${it.cls} (tổng ${it.total}); nguồn: ${(it.sources || []).map((s) => `\`${s.sel}\` ${s.value}`).join(", ") || "?"}`;
    if ("href" in it) return `${it.href}: top ${it.top} < đáy sticky ${it.stickyBottom}`;
    if ("target" in it && "name" in it) return `${it.name} trên \`${it.target}\` (${it.duration}ms)`;
    if ("sel" in it) return `\`${it.sel}\` "${it.text ?? ""}"`;
  }
  return "`" + JSON.stringify(it).slice(0, 200) + "`";
};

const lines = [];
const suites = [...new Set(recs.map((r) => r.suite))].sort();
let pass = 0, fail = 0, skip = 0;
for (const r of recs) for (const c of Object.values(r.checks)) c.skipped ? skip++ : c.pass ? pass++ : fail++;
lines.push(`# UX gate report`, "", `Nguồn: \`${path.relative(process.cwd(), dir)}\` · ${recs.length} bản ghi · check: **${pass} pass · ${fail} fail · ${skip} skip**`, "");
lines.push("Ký hiệu: ✓ đạt · ✗ hỏng (kèm biến thể/viewport hỏng và số vấn đề) · – bỏ qua / chưa áp dụng · trống = không đo.", "");

for (const suite of suites) {
  const rs = recs.filter((r) => r.suite === suite);
  const checks = [...new Set(rs.flatMap((r) => Object.keys(r.checks)))];
  const pages = [...new Set(rs.map((r) => r.page))].sort((a, b) => pageIdx(a) - pageIdx(b));
  lines.push(`## ${suite}`, "", `| Trang | ${checks.map(esc).join(" | ")} |`, `| --- | ${checks.map(() => "---").join(" | ")} |`);
  for (const pg of pages) {
    const cells = checks.map((ck) => {
      const hits = rs.filter((r) => r.page === pg && r.checks[ck]);
      if (!hits.length) return "";
      const bad = hits.filter((r) => !r.checks[ck].pass && !r.checks[ck].skipped);
      if (bad.length) return `✗ ${bad.map((r) => `${r.variant}(${r.checks[ck].items.length})`).join(", ")}`;
      if (hits.every((r) => r.checks[ck].skipped)) return "–";
      return "✓";
    });
    lines.push(`| ${esc(pageName.get(pg) ?? pg)} | ${cells.join(" | ")} |`);
  }
  lines.push("");
  const details = [];
  for (const pg of pages) for (const r of rs.filter((x) => x.page === pg)) for (const [ck, c] of Object.entries(r.checks)) {
    if (c.pass || c.skipped || !c.items.length) continue;
    details.push(`- **${esc(pageName.get(pg) ?? pg)} · ${r.variant} · ${esc(ck)}** (${c.items.length})`);
    for (const it of c.items.slice(0, MAX)) details.push(`  - ${esc(fmtItem(it))}`);
    if (c.items.length > MAX) details.push(`  - … +${c.items.length - MAX}`);
  }
  if (details.length) lines.push(`<details><summary>Chi tiết ${suite} (${details.filter((d) => d.startsWith("- ")).length} check hỏng)</summary>`, "", ...details, "", "</details>", "");
}

const md = lines.join("\n");
if (out) { writeFileSync(out, md); console.log(`Đã ghi ${out} (${pass} pass · ${fail} fail · ${skip} skip)`); } else console.log(md);
