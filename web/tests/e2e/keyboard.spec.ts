import { expect, test } from "./fixtures";
import { UX_PAGES, gotoUx, installUxHelpers, recordUx, settle, type CheckResult } from "./ux";

/**
 * Keyboard gate (project chromium):
 * 1. Tab đầu tiên từ đầu trang tới skip link (`a[href^="#"]` trỏ tới phần tử tồn tại) hoặc vào điều hướng chính
 *    (bên trong <header>/<nav>).
 * 2. Focus nhìn thấy được: Tab qua tối đa 40 phần tử; phần tử đang focus phải có outline (style ≠ none, width > 0)
 *    hoặc box-shadow ≠ none — trên chính nó, hoặc trên cha trực tiếp nếu cha đổi style khi focus (wrapper :focus-within).
 * 3. Escape đóng menu/popup đang mở: phần tử `[aria-expanded="true"]` / `[popover]` / `<details>` dạng dropdown
 *    (nội dung position absolute|fixed). `<details>` dạng disclosure thường (accordion) không bắt buộc đóng bằng Escape
 *    theo WAI-ARIA → chỉ ghi nhận (info), không fail.
 * 4. Editor bài viết: sửa tiêu đề → "Chưa lưu thay đổi"; Ctrl+S → "Đã lưu". Editor cluster: thử Ctrl+S, bỏ qua nếu chưa hỗ trợ.
 */

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Keyboard gate chạy trên project chromium");
  await installUxHelpers(page);
});

type Focused = { sel: string; text: string; tag: string; inHeaderOrNav: boolean; skipLink: boolean; thirdParty: boolean; focusStyle: { outline: string; boxShadow: string; parentChanged: boolean } };

/** Mô tả phần tử đang focus + style focus (so với khi blur). Gọi blur() → lần Tab sau tiếp tục từ vị trí này. */
function describeFocused(): Focused | null {
  const el = document.activeElement as HTMLElement | null;
  if (!el || el === document.body) return null;
  // transition focus (box-shadow/border 120–180ms) → tua tới trạng thái cuối trước khi đọc style
  const finish = () => [el, el.parentElement].forEach((n) => n?.getAnimations().forEach((a) => { try { a.finish(); } catch { /* vô hạn */ } }));
  finish();
  const cs = getComputedStyle(el);
  const outlineOn = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
  const parent = el.parentElement;
  const pStyle = (p: Element | null) => (p ? (() => { const s = getComputedStyle(p); return `${s.outlineStyle}|${s.outlineWidth}|${s.boxShadow}|${s.borderColor}`; })() : "");
  const parentFocused = pStyle(parent);
  const href = el.getAttribute("href") ?? "";
  const skipLink = el.tagName === "A" && href.startsWith("#") && href.length > 1 && !!document.getElementById(decodeURIComponent(href.slice(1)));
  const info: Focused = {
    sel: window.__ux.sel(el), text: window.__ux.text(el, 40) || el.getAttribute("aria-label") || "", tag: el.tagName.toLowerCase(),
    inHeaderOrNav: !!el.closest('header, nav, [role="navigation"]'), skipLink, thirdParty: window.__ux.inThirdParty(el),
    focusStyle: { outline: outlineOn ? `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}` : "none", boxShadow: cs.boxShadow, parentChanged: false },
  };
  el.blur();
  finish();
  info.focusStyle.parentChanged = pStyle(parent) !== parentFocused;
  return info;
}

for (const p of UX_PAGES) {
  test(`keyboard: skip link / nav trước, focus nhìn thấy — ${p.name}`, async ({ page }, testInfo) => {
    const { url, status } = await gotoUx(page, p);
    expect(status).toBe(200);
    await settle(page);
    await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur?.(); window.scrollTo(0, 0); });

    const stops: Focused[] = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      const f = await page.evaluate(describeFocused);
      if (!f) break; // hết vòng (focus ra khỏi document)
      if (stops.length && f.sel === stops[0].sel && f.text === stops[0].text) break;
      stops.push(f);
    }
    const first = stops[0];
    const firstOk = !!first && (first.skipLink || first.inHeaderOrNav);
    const invisible = stops.filter((s) => !s.thirdParty && s.focusStyle.outline === "none" && s.focusStyle.boxShadow === "none" && !s.focusStyle.parentChanged)
      .map((s) => ({ sel: s.sel, text: s.text, tag: s.tag }));

    const checks: Record<string, CheckResult> = {
      "first Tab → skip link / nav": { pass: firstOk, items: firstOk ? [] : [first ?? "không có phần tử focus được"], info: { first, skipLink: stops.some((s) => s.skipLink) } },
      "focus visible": { pass: invisible.length === 0, items: invisible, info: { tabStops: stops.length } },
    };
    await recordUx(testInfo, { suite: "keyboard", page: p.key, pageName: p.name, variant: "desktop", url, checks });
    expect.soft(firstOk, `Tab đầu tiên trên ${url} tới ${first?.sel} "${first?.text}" — cần skip link hoặc điều hướng chính`).toBe(true);
    expect.soft(invisible, `phần tử focus không có outline/box-shadow trên ${url}`).toEqual([]);
  });
}

for (const p of UX_PAGES) {
  test(`keyboard: Escape đóng menu/popup — ${p.name}`, async ({ page }, testInfo) => {
    const { url } = await gotoUx(page, p);
    await settle(page);
    // ứng viên: nút toggle aria-expanded=false (menu), <details> có summary
    const toggles = page.locator('main [aria-expanded="false"]:not([role="combobox"]), header [aria-expanded="false"]').filter({ visible: true });
    const details = page.locator("details").filter({ visible: true });
    const failures: unknown[] = [];
    const info: unknown[] = [];
    const nToggle = Math.min(await toggles.count(), 5);
    for (let i = 0; i < nToggle; i++) {
      const t = toggles.nth(i);
      const label = (await t.getAttribute("aria-label")) ?? (await t.innerText()).slice(0, 40);
      await t.click();
      if ((await t.getAttribute("aria-expanded")) !== "true") continue; // không phải toggle thật
      await page.keyboard.press("Escape");
      const closed = (await t.getAttribute("aria-expanded")) === "false";
      if (!closed) { failures.push({ kind: "aria-expanded", label }); await t.click().catch(() => {}); }
    }
    const nDetails = Math.min(await details.count(), 5);
    for (let i = 0; i < nDetails; i++) {
      const d = details.nth(i);
      const wasOpen = await d.evaluate((el) => (el as HTMLDetailsElement).open);
      if (wasOpen) continue;
      const summary = d.locator("summary").first();
      if (!(await summary.isVisible())) continue;
      await summary.click();
      const dropdown = await d.evaluate((el) => Array.from(el.children).some((c) => c.tagName !== "SUMMARY" && ["absolute", "fixed"].includes(getComputedStyle(c).position)));
      await page.keyboard.press("Escape");
      const open = await d.evaluate((el) => (el as HTMLDetailsElement).open);
      const label = (await summary.innerText()).slice(0, 40);
      if (open) {
        (dropdown ? failures : info).push({ kind: dropdown ? "details-dropdown" : "details-disclosure (không bắt buộc)", label });
        await summary.click().catch(() => {});
      }
    }
    await recordUx(testInfo, { suite: "keyboard", page: p.key, pageName: p.name, variant: "escape", url, checks: { "Escape closes menus": { pass: failures.length === 0, items: failures, info: { toggles: nToggle, details: nDetails, disclosuresNotClosed: info } } } });
    test.skip(nToggle + nDetails === 0, "Không có menu/details trên trang");
    expect.soft(failures, `Escape không đóng menu/popup trên ${url}`).toEqual([]);
  });
}

test("editor bài viết: Ctrl+S lưu (trạng thái đổi sang 'Đã lưu')", async ({ page }, testInfo) => {
  const p = UX_PAGES.find((x) => x.key === "article-editor")!;
  const { url, status } = await gotoUx(page, p);
  test.skip(status === 404, "Chưa có bài viết seed");
  await settle(page);
  const title = page.getByLabel("Tiêu đề bài viết");
  test.skip(!(await title.count()), "Editor chưa có ô tiêu đề");
  // trạng thái lưu của editor (role=status, aria-live) — không nhầm với SystemNotice "Chưa có ANTHROPIC_API_KEY … lưu …"
  const statusEl = page.getByRole("status").filter({ hasText: /^\s*(Chưa lưu thay đổi|Tất cả đã lưu|Đã lưu|Đã khôi phục|Đang)/ }).first();
  const original = await title.inputValue();
  await title.click();
  await title.press("End");
  await title.pressSequentially(" QA");
  await expect(statusEl).toContainText(/Chưa lưu/);
  await page.keyboard.press("Control+s");
  const ok = await expect(statusEl).toContainText(/Đã lưu|Tất cả đã lưu/, { timeout: 15_000 }).then(() => true, () => false);
  // trả lại tiêu đề gốc
  await title.fill(original);
  await page.keyboard.press("Control+s");
  await expect(statusEl).toContainText(/Đã lưu|Tất cả đã lưu/, { timeout: 15_000 }).catch(() => {});
  await recordUx(testInfo, { suite: "keyboard", page: p.key, pageName: p.name, variant: "ctrl-s", url, checks: { "Ctrl+S saves": { pass: ok, items: ok ? [] : ["Ctrl+S không đổi trạng thái sang 'Đã lưu'"] } } });
  expect(ok, "Ctrl+S lưu bài").toBe(true);
});

test("editor cluster: Ctrl+S lưu nếu được hỗ trợ", async ({ page }, testInfo) => {
  const p = UX_PAGES.find((x) => x.key === "cluster-editor")!;
  const { url } = await gotoUx(page, p);
  await settle(page);
  const pillar = page.getByLabel("Tiêu đề pillar");
  test.skip(!(await pillar.count()), "Editor cluster chưa có ô tiêu đề pillar");
  const original = await pillar.inputValue();
  await pillar.click();
  await pillar.press("End");
  await pillar.pressSequentially(" QA");
  await expect(page.getByText("Chưa lưu thay đổi")).toBeVisible();
  await page.keyboard.press("Control+s");
  const saved = await expect(page.getByText(/Đã lưu|Tất cả đã lưu/).first()).toBeVisible({ timeout: 8000 }).then(() => true, () => false);
  await recordUx(testInfo, { suite: "keyboard", page: p.key, pageName: p.name, variant: "ctrl-s", url, checks: { "Ctrl+S saves": { pass: saved, skipped: saved ? undefined : "chưa hỗ trợ Ctrl+S", items: [] } } });
  if (saved) { await pillar.fill(original); await page.keyboard.press("Control+s"); await expect(page.getByText(/Đã lưu|Tất cả đã lưu/).first()).toBeVisible({ timeout: 8000 }).catch(() => {}); }
  test.skip(!saved, "Editor cluster chưa hỗ trợ Ctrl+S (không bắt buộc)");
});
