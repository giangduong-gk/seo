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
 * - `scrollable-region-focusable` cho vùng cuộn `tabindex=0` nằm trong `fieldset[disabled]` (form khoá khi thiếu API key):
 *   axe coi là không focus được nhưng trình duyệt vẫn focus được → kiểm tra thực tế bằng el.focus() rồi mới bỏ qua.
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

    // Dương tính giả đã kiểm chứng: axe-core 4.13 (`focusDisabled`) coi MỌI hậu duệ của `fieldset[disabled]` là không
    // focus được, nhưng Chrome vẫn focus/cuộn được `div[tabindex=0]` bên trong (fieldset chỉ vô hiệu form control).
    // Chỉ bỏ node `scrollable-region-focusable` nằm trong fieldset[disabled] VÀ thực sự nhận focus trong trình duyệt.
    const falsePositives: string[] = [];
    for (const v of results.violations.filter((x) => x.id === "scrollable-region-focusable")) {
      const keep = [];
      for (const n of v.nodes) {
        const sel = n.target.join(" ");
        const fp = await page.evaluate((q) => {
          const el = document.querySelector(q) as HTMLElement | null;
          if (!el || !el.closest("fieldset[disabled]")) return false;
          el.focus();
          const ok = document.activeElement === el;
          el.blur();
          return ok;
        }, sel).catch(() => false);
        if (fp) falsePositives.push(`${v.id}: ${sel} (trong fieldset[disabled], focus được)`); else keep.push(n);
      }
      v.nodes = keep;
    }
    results.violations = results.violations.filter((v) => v.nodes.length > 0);

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
        "moderate+minor (không chặn)": { pass: true, items: nonBlocking, info: falsePositives.length ? { axeFalsePositivesIgnored: falsePositives } : undefined },
      },
    });

    const compact = blocking.map((v) => `[${v.impact}] ${v.id} ×${v.count}: ${v.help} → ${v.nodes.map((n) => n.target).join(" | ")}`);
    expect(compact, `Vi phạm axe serious/critical trên ${url} (chi tiết trong attachment axe-*.json)`).toEqual([]);
  });
}

/**
 * Tên landmark/region phải duy nhất trên trang (axe `landmark-unique` thuộc nhóm best-practice nên không nằm trong
 * bộ tag WCAG ở trên): hai `section[aria-label="X"]` cùng tên khiến trình đọc màn hình liệt kê hai vùng giống hệt nhau.
 */
for (const p of UX_PAGES) {
  test(`a11y: tên region/landmark duy nhất — ${p.name}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Cấu trúc landmark giống nhau trên mọi viewport");
    const { url } = await gotoUx(page, p);
    await settle(page);
    const dups = await page.evaluate(() => {
      const roleOf = (el: Element) => el.getAttribute("role") || ({ SECTION: "region", NAV: "navigation", ASIDE: "complementary", FORM: "form", MAIN: "main", HEADER: "banner", FOOTER: "contentinfo" } as Record<string, string>)[el.tagName] || "";
      const nameOf = (el: Element) => (el.getAttribute("aria-label") || (el.getAttribute("aria-labelledby") || "").split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "").join(" ")).trim();
      const seen = new Map<string, string[]>();
      for (const el of Array.from(document.querySelectorAll("section[aria-label], section[aria-labelledby], nav[aria-label], aside[aria-label], form[aria-label], [role=region][aria-label], [role=navigation][aria-label], [role=complementary][aria-label]"))) {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (cs.display === "none" || cs.visibility === "hidden" || (r.width === 0 && r.height === 0 && el.childElementCount > 0)) continue;
        const key = `${roleOf(el)}|${nameOf(el)}`;
        if (!nameOf(el)) continue;
        const sel = el.tagName.toLowerCase() + (el.id ? `#${el.id}` : "") + Array.from(el.classList).slice(0, 1).map((c) => "." + c).join("") + `[aria-label="${nameOf(el)}"]`;
        seen.set(key, [...(seen.get(key) ?? []), sel]);
      }
      return [...seen.entries()].filter(([, v]) => v.length > 1).map(([k, v]) => ({ landmark: k, elements: v }));
    });
    await recordUx(testInfo, { suite: "a11y", page: p.key, pageName: p.name, variant: "landmarks", url, checks: { "unique landmark names": { pass: dups.length === 0, items: dups } } });
    expect(dups, `landmark trùng tên trên ${url}`).toEqual([]);
  });
}
