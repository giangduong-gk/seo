import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";
import { UX_PAGES, gotoUx, recordUx, settle } from "./ux";

/**
 * Accessibility gate (axe-core, WCAG 2.0 A/AA + 2.1 AA) cho mọi trang, trên cả desktop và phone.
 * - FAIL khi có vi phạm `serious` hoặc `critical`.
 * - `moderate`/`minor` chỉ được log + ghi vào báo cáo (không chặn).
 * - Báo cáo axe đầy đủ đính kèm dạng JSON (testInfo.attach) và tóm tắt ghi vào test-results/ux-report.
 * - Chạy với `prefers-reduced-motion: reduce` để animation vào trang (opacity/translate) không làm sai phép đo tương phản.
 *
 * Danh sách loại trừ (bên thứ ba, có lý do):
 * - `nextjs-portal`: overlay/indicator của Next dev server — không có trong bản build production.
 * - `.react-flow__minimap`, `.react-flow__attribution`: SVG minimap và link "React Flow" do thư viện @xyflow/react render;
 *   app không kiểm soát markup bên trong. Node/edge/controls của React Flow VẪN được quét.
 */
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21aa"];
const AXE_EXCLUDE = ["nextjs-portal", ".react-flow__minimap", ".react-flow__attribution"];
const BLOCKING = new Set(["serious", "critical"]);

for (const p of UX_PAGES) {
  test(`a11y (axe): ${p.name}`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const { url, status } = await gotoUx(page, p);
    expect(status, `HTTP ${url}`).toBe(200);
    await settle(page);
    if (p.key === "cluster-editor") await expect.poll(() => page.locator(".react-flow__node").count(), { timeout: 30_000 }).toBeGreaterThan(0);

    let builder = new AxeBuilder({ page }).withTags(AXE_TAGS);
    for (const sel of AXE_EXCLUDE) builder = builder.exclude(sel);
    const results = await builder.analyze();

    await testInfo.attach(`axe-${p.key}-${testInfo.project.name}.json`, { body: JSON.stringify(results, null, 2), contentType: "application/json" });

    const summarize = (v: (typeof results.violations)[number]) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.slice(0, 8).map((n) => ({ target: n.target.join(" "), html: n.html.slice(0, 160), summary: (n.failureSummary ?? "").split("\n").slice(1, 3).join(" ").trim() })),
      count: v.nodes.length,
    });
    const blocking = results.violations.filter((v) => BLOCKING.has(v.impact ?? "")).map(summarize);
    const nonBlocking = results.violations.filter((v) => !BLOCKING.has(v.impact ?? "")).map(summarize);
    for (const v of nonBlocking) console.log(`[a11y ${testInfo.project.name}] ${p.key}: ${v.impact} ${v.id} ×${v.count} — ${v.help} — ${v.nodes[0]?.target}`);

    await recordUx(testInfo, {
      suite: "a11y", page: p.key, pageName: p.name, variant: testInfo.project.name, url,
      checks: {
        "serious+critical": { pass: blocking.length === 0, items: blocking },
        "moderate+minor (không chặn)": { pass: true, items: nonBlocking },
      },
    });

    const compact = blocking.map((v) => `[${v.impact}] ${v.id} ×${v.count}: ${v.help} → ${v.nodes.map((n) => n.target).join(" | ")}`);
    expect(compact, `Vi phạm axe serious/critical trên ${url} (chi tiết trong attachment axe-*.json)`).toEqual([]);
  });
}
