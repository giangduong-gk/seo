import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { briefToMarkdown } from "@/lib/brief";
import { ContentBrief } from "@/lib/schemas";
import { WEB_ROOT } from "./_helpers";

const brief = ContentBrief.parse(JSON.parse(readFileSync(path.join(WEB_ROOT, "prisma/fixtures/sample-brief.json"), "utf8")));

describe("briefToMarkdown — xuất Content Brief ra Markdown", () => {
  const md = briefToMarkdown(brief, { project: "Demo", createdAt: new Date("2026-10-10T08:00:00Z") });

  it("bắt đầu bằng '# Content Brief: <title>' và dòng meta dự án + ngày", () => {
    expect(md.startsWith(`# Content Brief: ${brief.title}`)).toBe(true);
    expect(md).toContain("> Dự án: Demo · 2026-10-10");
  });

  it("không có dòng meta khi không truyền meta", () => {
    expect(briefToMarkdown(brief)).not.toContain("> Dự án:");
  });

  it("có đủ các mục chính", () => {
    for (const h of ["## Thông tin chung", "## Outline", "## E-E-A-T", "## Checklist GEO", "## Schema (JSON-LD)", "## Multi-format", "## FAQ", "## Không được"]) {
      expect(md).toContain(h);
    }
    expect(md).toContain(`- **Từ khoá mục tiêu:** ${brief.targetKeyword}`);
    expect(md).toContain(`- **Slug:** /${brief.slug}`);
    expect(md).toContain(`${brief.wordCountMin}–${brief.wordCountMax} từ`);
  });

  it("outline: heading cấp N trở thành #(N+1), có dòng Answer-first và từ khoá", () => {
    const h1 = brief.outline.find((o) => o.level === 1)!;
    const h2 = brief.outline.find((o) => o.level === 2 && o.answerFirst)!;
    expect(md).toContain(`## ${h1.heading}`);
    expect(md).toContain(`### ${h2.heading}`);
    expect(md).toContain(`> **Answer-first:** ${h2.answerFirst}`);
    if (h2.keywords.length) expect(md).toContain(`- Từ khoá: ${h2.keywords.join(", ")}`);
  });

  it("checklist GEO dạng checkbox có priority; FAQ in đậm câu hỏi", () => {
    const c = brief.geoChecklist[0];
    expect(md).toContain(`- [ ] **[${c.priority}]** ${c.label} — ${c.why}`);
    const f = brief.faq[0];
    expect(md).toContain(`**${f.question}**\n${f.answerDraft}`);
  });

  it("tách internal/external links theo type", () => {
    const internal = brief.links.filter((l) => l.type === "internal");
    const external = brief.links.filter((l) => l.type === "external");
    if (internal.length) expect(md).toContain("## Internal links");
    if (external.length) expect(md).toContain("## External links");
    for (const l of brief.links) expect(md).toContain(`- → ${l.to} · anchor: "${l.anchor}"`);
  });

  it("danh sách rỗng không gây lỗi và không in mục link", () => {
    const empty = briefToMarkdown({ ...brief, links: [], eeatSources: [], faq: [], doNot: [] });
    expect(empty).not.toContain("## Internal links");
    expect(empty).not.toContain("## External links");
    expect(empty).not.toContain("Nguồn nên dẫn");
    expect(empty).toContain("## Không được");
  });
});
