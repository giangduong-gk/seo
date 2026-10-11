import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { UX_PAGES, gotoUx, installUxHelpers, pageHeightInViewports, recordUx, settle } from "./ux";

/**
 * Motion gate (project chromium):
 * 1. `prefers-reduced-motion: reduce` → sau khi tải không còn animation hữu hạn đang chạy (vô hạn như skeleton/spinner
 *    được bỏ qua) và `html { scroll-behavior }` ≠ smooth — trên mọi trang.
 * 2. Không giảm chuyển động → `scroll-behavior: smooth`.
 * 3. Bấm link mục lục (`nav[aria-label]` / `[role=navigation][aria-label]` có `a[href^="#"]`) trên trang phân tích & brief
 *    → section đích nằm DƯỚI header + sub-nav + dải TOC (top ≥ đáy sticky − 2px). Bỏ qua nếu trang chưa có TOC.
 * 4. NavProgress: bấm link nội bộ → thanh 2px ở đỉnh xuất hiện, biến mất sau khi điều hướng xong.
 * 5. BackToTop: hiện sau khi cuộn 2 màn hình trên trang dài, bấm → về đầu trang.
 * 6. Vùng toast `[role=region][aria-label="Thông báo"]` tồn tại.
 */

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Motion gate chạy trên project chromium");
  await installUxHelpers(page);
});

/** Animation đang chạy, không vô hạn, trên DocumentTimeline hoặc scroll/view timeline. */
function runningFiniteAnimations() {
  const isInfinite = (a: Animation) => {
    const t = a.effect?.getComputedTiming();
    return !t || t.iterations === Infinity || t.endTime === Infinity;
  };
  // Bỏ qua: transition/animation ≤ 10ms (kỹ thuật reset reduced-motion chuẩn `transition-duration: 0.01ms`, không nhìn thấy)
  // và overlay dev của Next (nextjs-portal).
  const tiny = (a: Animation) => { const d = Number(a.effect?.getComputedTiming().duration); return Number.isFinite(d) && d <= 10; };
  const devOverlay = (a: Animation) => { const t = (a.effect as KeyframeEffect | null)?.target; return !!t && !!(t as Element).closest?.("nextjs-portal"); };
  return document.getAnimations()
    .filter((a) => a.playState === "running" && !isInfinite(a) && !tiny(a) && !devOverlay(a))
    .map((a) => {
      const target = (a.effect as KeyframeEffect | null)?.target ?? null;
      const name = (a as CSSAnimation).animationName ?? (a as CSSTransition).transitionProperty ?? a.id ?? "web-animation";
      return { name: `${a.constructor.name}:${name}`, target: target ? window.__ux.sel(target) : "(none)", duration: String(a.effect?.getComputedTiming().duration) };
    });
}

for (const p of UX_PAGES) {
  test(`reduced motion: không animation, không smooth scroll — ${p.name}`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const { url, status } = await gotoUx(page, p);
    expect(status).toBe(200);
    // lấy mẫu ngay sau load và sau khi hydrate (+300ms) — animation ngắn có thể đã kết thúc ở lần sau
    const first = await page.evaluate(runningFiniteAnimations);
    await page.waitForTimeout(300);
    const second = await page.evaluate(runningFiniteAnimations);
    const seen = new Map<string, (typeof first)[number]>();
    for (const a of [...first, ...second]) seen.set(`${a.name}|${a.target}`, a);
    const anims = [...seen.values()];
    const scrollBehavior = await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);

    await recordUx(testInfo, {
      suite: "motion", page: p.key, pageName: p.name, variant: "reduce", url,
      checks: {
        "reduced: no running animations": { pass: anims.length === 0, items: anims },
        "reduced: scroll-behavior ≠ smooth": { pass: scrollBehavior !== "smooth", items: scrollBehavior === "smooth" ? [{ scrollBehavior }] : [] },
      },
    });
    expect.soft(anims, `animation còn chạy khi reduced-motion trên ${url}`).toEqual([]);
    expect.soft(scrollBehavior, "scroll-behavior khi reduced-motion").not.toBe("smooth");
  });
}

test("không giảm chuyển động → html scroll-behavior: smooth", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("smooth");
});

/** Đáy thấp nhất của các phần tử sticky/fixed bám mép trên (header, sub-nav, dải TOC). */
function stickyTopBottom() {
  const vw = window.innerWidth;
  let bottom = 0;
  const parts: string[] = [];
  for (const el of Array.from(document.body.querySelectorAll("*"))) {
    const pos = getComputedStyle(el).position;
    if (pos !== "sticky" && pos !== "fixed") continue;
    if (window.__ux.inThirdParty(el) || !window.__ux.visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.height <= 3 || r.top > 220 || r.width < vw * 0.5) continue; // chỉ thanh ngang ở mép trên (bỏ cột TOC dọc, nút nổi)
    if (r.bottom > bottom) bottom = r.bottom;
    parts.push(`${window.__ux.sel(el)} [${Math.round(r.top)}–${Math.round(r.bottom)}]`);
  }
  return { bottom: Math.round(bottom), parts };
}

async function waitScrollIdle(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    let last = -1, still = 0;
    const tick = () => { const y = window.scrollY; still = y === last ? still + 1 : 0; last = y; if (still >= 6) resolve(); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    setTimeout(resolve, 4000);
  }));
}

for (const p of UX_PAGES.filter((x) => x.toc)) {
  for (const w of [1440, 390]) {
    test(`TOC: bấm mục → section nằm dưới header/sub-nav — ${p.name} @${w}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: w, height: w > 800 ? 900 : 844 });
      const { url } = await gotoUx(page, p);
      await settle(page);
      const toc = page.locator('nav[aria-label], [role="navigation"][aria-label]').filter({ has: page.locator('a[href^="#"]') });
      const visibleToc = toc.filter({ visible: true }).first();
      if (!(await visibleToc.count())) {
        await recordUx(testInfo, { suite: "motion", page: p.key, pageName: p.name, variant: `toc-${w}`, url, checks: { "toc anchor offset": { pass: true, skipped: "chưa có TOC", items: [] } } });
        test.skip(true, `Chưa có mục lục trên ${p.name} @${w}px`);
        return;
      }
      const links = visibleToc.locator('a[href^="#"]');
      const n = await links.count();
      const results: { href: string; top: number; stickyBottom: number; ok: boolean; sticky: string[] }[] = [];
      // mục thứ 3 (giữa trang) và mục cuối
      for (const i of [...new Set([Math.min(2, n - 1), n - 1])]) {
        const link = links.nth(i);
        const href = (await link.getAttribute("href")) ?? "";
        await link.click();
        await waitScrollIdle(page);
        const m = await page.evaluate((id) => {
          const t = document.getElementById(decodeURIComponent(id.slice(1)));
          const atEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
          return { top: t ? Math.round(t.getBoundingClientRect().top) : NaN, atEnd };
        }, href);
        const sb = await page.evaluate(stickyTopBottom);
        // ở cuối trang không cuộn tiếp được thì section có thể nằm thấp hơn — vẫn phải không bị che
        results.push({ href, top: m.top, stickyBottom: sb.bottom, ok: Number.isFinite(m.top) && m.top >= sb.bottom - 2, sticky: sb.parts });
      }
      const bad = results.filter((r) => !r.ok);
      await recordUx(testInfo, { suite: "motion", page: p.key, pageName: p.name, variant: `toc-${w}`, url, checks: { "toc anchor offset": { pass: bad.length === 0, items: bad, info: results } } });
      expect.soft(bad, "section đích bị header/sub-nav/TOC che (top < đáy sticky − 2px)").toEqual([]);
    });
  }
}

test("NavProgress: thanh 2px hiện khi bấm link nội bộ và biến mất sau điều hướng", async ({ page }, testInfo) => {
  await page.goto(UX_PAGES.find((x) => x.key === "project")!.path as string);
  await settle(page);
  // MutationObserver ghi nhận thanh fixed ở đỉnh, cao ≤ 3px, rộng ≥ nửa viewport
  await page.evaluate(() => {
    (window as unknown as { __navbar: boolean }).__navbar = false;
    const check = () => {
      for (const el of Array.from(document.body.querySelectorAll("div"))) {
        const cs = getComputedStyle(el);
        if (cs.position !== "fixed") continue;
        const r = el.getBoundingClientRect();
        if (r.top <= 1 && r.height > 0 && r.height <= 3 && r.width >= window.innerWidth / 2) { (window as unknown as { __navbar: boolean }).__navbar = true; return; }
      }
    };
    new MutationObserver(check).observe(document.body, { childList: true, subtree: true });
  });
  await page.getByRole("navigation", { name: "Mục trong dự án" }).getByRole("link", { name: /Content Brief/ }).click();
  await page.waitForURL(/\/briefs$/);
  const appeared = await page.evaluate(() => (window as unknown as { __navbar: boolean }).__navbar);
  // sau điều hướng: biến mất (state done → idle sau ~320ms)
  const gone = await expect.poll(() => page.evaluate(() => !Array.from(document.body.querySelectorAll("div")).some((el) => {
    const r = el.getBoundingClientRect();
    return getComputedStyle(el).position === "fixed" && r.top <= 1 && r.height > 0 && r.height <= 3 && r.width >= window.innerWidth / 2;
  })), { timeout: 5000 }).toBe(true).then(() => true, () => false);
  await recordUx(testInfo, { suite: "motion", page: "project", pageName: "Dự án", variant: "navprogress", checks: { "NavProgress appears": { pass: appeared, items: appeared ? [] : ["không thấy thanh 2px khi bấm link Content Brief"] }, "NavProgress disappears": { pass: gone, items: gone ? [] : ["thanh 2px còn sau 5s"] } } });
  expect.soft(appeared, "thanh NavProgress xuất hiện").toBe(true);
  expect.soft(gone, "thanh NavProgress biến mất sau điều hướng").toBe(true);
});

for (const w of [1440, 390]) {
  test(`BackToTop: hiện sau 2 màn hình, bấm về đầu trang @${w}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: w, height: w > 800 ? 900 : 844 });
    // chọn trang dài nhất trong các trang "long"
    let chosen: string | null = null;
    for (const p of UX_PAGES.filter((x) => x.long)) {
      await gotoUx(page, p);
      await settle(page);
      if ((await pageHeightInViewports(page)) >= 3.2) { chosen = p.key; break; }
    }
    test.skip(!chosen, "Không có trang nào dài ≥ 3,2 màn hình");
    const btn = page.getByRole("button", { name: "Lên đầu trang" });
    await expect(btn).toHaveCount(1);
    const shown = () => btn.evaluate((el) => { const cs = getComputedStyle(el); return Number(cs.opacity) > 0.5 && cs.pointerEvents !== "none" && cs.visibility !== "hidden"; });
    const initiallyHidden = !(await shown());
    await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 2 + 20, behavior: "instant" as ScrollBehavior }));
    const appears = await expect.poll(shown, { timeout: 3000 }).toBe(true).then(() => true, () => false);
    let returned = false;
    if (appears) {
      await btn.click();
      returned = await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 4000 }).toBeLessThan(5).then(() => true, () => false);
    }
    await recordUx(testInfo, {
      suite: "motion", page: chosen!, pageName: chosen!, variant: `backtotop-${w}`,
      checks: { "BackToTop hidden at top": { pass: initiallyHidden, items: initiallyHidden ? [] : ["nút hiện khi đang ở đầu trang"] }, "BackToTop appears after 2 viewports": { pass: appears, items: appears ? [] : ["không hiện"] }, "BackToTop returns to top": { pass: returned, items: returned ? [] : ["không về đầu trang"] } },
    });
    expect.soft(initiallyHidden, "BackToTop ẩn ở đầu trang").toBe(true);
    expect.soft(appears, "BackToTop hiện sau khi cuộn 2 màn hình").toBe(true);
    expect.soft(returned, "BackToTop về đầu trang").toBe(true);
  });
}

test("vùng toast [role=region][aria-label=Thông báo] tồn tại", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('[role="region"][aria-label="Thông báo"]')).toHaveCount(1);
  await expect(page.locator('[role="region"][aria-label="Thông báo"]')).toHaveAttribute("aria-live", /polite|assertive/);
});
