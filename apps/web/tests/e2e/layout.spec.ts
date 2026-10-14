import { expect, test } from "./fixtures";
import { UX_PAGES, VIEWPORTS, evalRetry, gotoUx, installUxHelpers, recordUx, settle, type CheckResult } from "./ux";

/**
 * Layout gate — mọi trang × 4 viewport (360 · 768 · 1024 · 1440) trên project `chromium`, và kiểm tra vùng chạm
 * trên project `phone` (390×844, isMobile, hasTouch).
 *
 * (a) không tràn ngang cấp trang (scrollWidth ≤ innerWidth) — kèm "thủ phạm" (phần tử ngoài cùng lòi khỏi viewport)
 * (b) không phần tử nào có nội dung tràn khỏi hộp của nó theo chiều ngang, trừ vùng cuộn chủ ý (overflow-x auto|scroll),
 *     cắt chữ chủ ý (text-overflow: ellipsis), hoặc nội bộ React Flow / overlay dev của Next
 * (c) không H1 nào bị cắt bằng ellipsis / line-clamp
 * (d) phần tử sticky/fixed (header, sub-nav, dải TOC, toolbar…) không đè lên heading đầu tiên của <main> sau khi tải,
 *     và khi đã cuộn xuống giữa trang các phần tử sticky không chồng lên nhau
 * (e) CLS < 0.1 (cửa sổ phiên lớn nhất theo định nghĩa web-vitals), đo bằng PerformanceObserver buffered sau load + 1s
 * (f) vùng chạm ≥ 40×40 cho button / a / [role=button] / checkbox trong <main> (trừ link nằm trong đoạn văn `p a`)
 *
 * Mỗi check dùng expect.soft → một test báo đủ mọi check hỏng; chi tiết (selector + đoạn text) nằm trong
 * test-results/ux-report/layout__*.json và bảng tổng hợp `node scripts/ux-report.mjs`.
 */

const CLS_MAX = 0.1;
const TOUCH_MIN = 40;
const VIEWPORT_HEIGHT: Record<number, number> = { 360: 780, 768: 1024, 1024: 768, 1440: 900 };

type Audit = {
  pageOverflow: { scrollWidth: number; innerWidth: number; culprits: { sel: string; text: string; left: number; right: number }[] } | null;
  overflow: { sel: string; text: string; kind: "spills" | "clipped"; scrollWidth: number; clientWidth: number; child?: string }[];
  h1Clipped: { sel: string; text: string; how: string }[];
  heading: string | null;
  stickyOverHeading: { sticky: string; heading: string; overlapPx: number }[];
};

/** Chạy trong trình duyệt. */
function auditLayout(): Audit {
  const ux = window.__ux;
  const vw = window.innerWidth;
  const de = document.documentElement;
  const all = Array.from(document.body.querySelectorAll("*"));
  const skipTag = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "INPUT", "TEXTAREA", "SELECT", "OPTION", "BR", "IFRAME"]);

  const clippedByAncestor = (el: Element) => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const ox = getComputedStyle(a).overflowX;
      if (ox !== "visible") return true;
    }
    return false;
  };

  // (a)
  let pageOverflow: Audit["pageOverflow"] = null;
  if (de.scrollWidth > vw) {
    const sticking = all.filter((el) => {
      if (skipTag.has(el.tagName) || ux.inThirdParty(el) || !ux.visible(el)) return false;
      const r = el.getBoundingClientRect();
      return (r.right > vw + 1 || r.left < -1) && !clippedByAncestor(el);
    });
    const outer = sticking.filter((el) => !sticking.some((o) => o !== el && o.contains(el)));
    pageOverflow = {
      scrollWidth: de.scrollWidth, innerWidth: vw,
      culprits: outer.slice(0, 10).map((el) => { const r = el.getBoundingClientRect(); return { sel: ux.sel(el), text: ux.text(el), left: Math.round(r.left), right: Math.round(r.right) }; }),
    };
  }

  // (b)
  const raw: { el: Element; kind: "spills" | "clipped"; sw: number; cw: number }[] = [];
  for (const el of all) {
    if (skipTag.has(el.tagName) || ux.inThirdParty(el)) continue;
    if (el.closest("svg") && el.tagName.toLowerCase() !== "svg") continue;
    const cs = getComputedStyle(el);
    if (cs.display === "inline" || cs.display === "contents" || cs.display === "none") continue;
    const cw = el.clientWidth;
    const sw = el.scrollWidth;
    if (cw === 0 || sw <= cw + 1) continue;
    if (!ux.visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 2) continue; // sr-only / visually-hidden
    const ox = cs.overflowX;
    if (ox === "auto" || ox === "scroll") continue; // vùng cuộn chủ ý
    if (ox === "hidden" || ox === "clip") {
      if (cs.textOverflow === "ellipsis") continue; // cắt chữ chủ ý (H1 kiểm tra riêng ở (c))
      if (cs.clip !== "auto" || cs.clipPath !== "none") continue;
      raw.push({ el, kind: "clipped", sw, cw });
    } else raw.push({ el, kind: "spills", sw, cw });
  }
  // Chỉ tính tràn do con "trong luồng" (element không absolute/fixed, hoặc text) vượt mép trong của hộp.
  // Tràn do trang trí định vị tuyệt đối (mũi tên ::after, dropdown ẩn…) là chủ ý → bỏ qua.
  const explained = (el: Element) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const inL = r.left + parseFloat(cs.borderLeftWidth) - 1, inR = r.right - parseFloat(cs.borderRightWidth) + 1;
    for (const n of Array.from(el.childNodes)) {
      if (n.nodeType === Node.ELEMENT_NODE) {
        const ccs = getComputedStyle(n as Element);
        if (ccs.position === "absolute" || ccs.position === "fixed" || ccs.display === "none") continue;
        // full-bleed chủ ý: con có margin ngang âm (vd. thanh công cụ sticky tràn sát mép màn hình)
        if (parseFloat(ccs.marginLeft) < 0 || parseFloat(ccs.marginRight) < 0) continue;
        const cr = (n as Element).getBoundingClientRect();
        if (cr.width > 0 && (cr.right > inR || cr.left < inL)) return true;
      } else if (n.nodeType === Node.TEXT_NODE && n.textContent?.trim()) {
        const range = document.createRange(); range.selectNodeContents(n);
        if (Array.from(range.getClientRects()).some((q) => q.width > 0 && (q.right > inR || q.left < inL))) return true;
      }
    }
    return false;
  };
  const real = raw.filter((x) => explained(x.el));
  // giữ phần tử sâu nhất (tổ tiên với overflow:visible tự động "kế thừa" scrollWidth của con)
  const deepest = real.filter((x) => !real.some((o) => o !== x && x.el.contains(o.el)));
  const overflow: Audit["overflow"] = deepest.slice(0, 15).map(({ el, kind, sw, cw }) => {
    const r = el.getBoundingClientRect();
    const wide = Array.from(el.children).find((c) => { const cr = c.getBoundingClientRect(); return cr.width > 0 && (cr.right > r.right + 1 || cr.left < r.left - 1); });
    return { sel: ux.sel(el), text: ux.text(el), kind, scrollWidth: sw, clientWidth: cw, child: wide ? `${ux.sel(wide)} (${Math.round(wide.getBoundingClientRect().width)}px)` : undefined };
  });

  // (c)
  const h1Clipped: Audit["h1Clipped"] = [];
  for (const h of Array.from(document.querySelectorAll('h1, [role="heading"][aria-level="1"]'))) {
    for (const el of [h, ...Array.from(h.querySelectorAll("*"))]) {
      const cs = getComputedStyle(el);
      if (cs.textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 1) h1Clipped.push({ sel: ux.sel(el), text: ux.text(h), how: "text-overflow: ellipsis" });
      const clamp = cs.getPropertyValue("-webkit-line-clamp");
      if (clamp && clamp !== "none" && el.scrollHeight > el.clientHeight + 1) h1Clipped.push({ sel: ux.sel(el), text: ux.text(h), how: `line-clamp ${clamp}` });
    }
  }

  // (d) heading đầu tiên của main
  const main = document.querySelector("main");
  const headingEl = (main && (Array.from(main.querySelectorAll("h1")).find((h) => ux.visible(h)) || Array.from(main.querySelectorAll("h1, h2")).find((h) => ux.visible(h)))) || null;
  const stickyOverHeading: Audit["stickyOverHeading"] = [];
  if (headingEl) {
    const h = headingEl.getBoundingClientRect();
    for (const el of all) {
      const pos = getComputedStyle(el).position;
      if (pos !== "sticky" && pos !== "fixed") continue;
      if (ux.inThirdParty(el) || !ux.visible(el) || el.contains(headingEl) || headingEl.contains(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.height <= 3) continue; // thanh NavProgress 2px
      const ox = Math.min(r.right, h.right) - Math.max(r.left, h.left);
      const oy = Math.min(r.bottom, h.bottom) - Math.max(r.top, h.top);
      if (ox > 1 && oy > 1) stickyOverHeading.push({ sticky: ux.sel(el), heading: ux.text(headingEl, 40), overlapPx: Math.round(oy) });
    }
  }
  return { pageOverflow, overflow, h1Clipped, heading: headingEl ? ux.text(headingEl, 40) : null, stickyOverHeading };
}

/** Cuộn xuống giữa trang rồi tìm các cặp sticky/fixed ở mép trên chồng lên nhau. */
function auditStickyStack() {
  const ux = window.__ux;
  window.scrollTo({ top: Math.max(0, (document.documentElement.scrollHeight - window.innerHeight) / 2), behavior: "instant" as ScrollBehavior });
  const stickies = Array.from(document.body.querySelectorAll("*")).filter((el) => {
    const pos = getComputedStyle(el).position;
    if ((pos !== "sticky" && pos !== "fixed") || ux.inThirdParty(el) || !ux.visible(el)) return false;
    const r = el.getBoundingClientRect();
    return r.height > 3 && r.top < window.innerHeight / 2 && r.bottom > 0;
  });
  const out: { a: string; b: string; overlapPx: number }[] = [];
  for (let i = 0; i < stickies.length; i++)
    for (let j = i + 1; j < stickies.length; j++) {
      const A = stickies[i], B = stickies[j];
      if (A.contains(B) || B.contains(A)) continue;
      const a = A.getBoundingClientRect(), b = B.getBoundingClientRect();
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 1 && oy > 1) out.push({ a: ux.sel(A), b: ux.sel(B), overlapPx: Math.round(oy) });
    }
  window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  return out;
}

/** CLS theo web-vitals: cửa sổ phiên (khoảng cách < 1s, tối đa 5s), lấy cửa sổ lớn nhất. */
function measureCls(): Promise<{ cls: number; total: number; sources: { sel: string; value: number }[] }> {
  return new Promise((resolve) => {
    type LS = PerformanceEntry & { value: number; hadRecentInput: boolean; sources?: { node?: Node | null }[] };
    const entries: LS[] = [];
    try {
      const po = new PerformanceObserver((list) => { for (const e of list.getEntries()) entries.push(e as LS); });
      po.observe({ type: "layout-shift", buffered: true });
      setTimeout(() => {
        for (const e of po.takeRecords()) entries.push(e as LS);
        po.disconnect();
        const shifts = entries.filter((e) => !e.hadRecentInput).sort((a, b) => a.startTime - b.startTime);
        let max = 0, cur = 0, first = 0, last = 0, total = 0;
        for (const e of shifts) {
          total += e.value;
          if (cur && e.startTime - last < 1000 && e.startTime - first < 5000) cur += e.value; else { cur = e.value; first = e.startTime; }
          last = e.startTime; max = Math.max(max, cur);
        }
        const sources = shifts.filter((e) => e.value > 0.005).flatMap((e) => (e.sources ?? []).map((s) => ({ sel: s.node instanceof Element ? window.__ux.sel(s.node) : s.node?.nodeName ?? "(gone)", value: Math.round(e.value * 1000) / 1000 }))).slice(0, 8);
        resolve({ cls: Math.round(max * 1000) / 1000, total: Math.round(total * 1000) / 1000, sources });
      }, 50);
    } catch { resolve({ cls: 0, total: 0, sources: [{ sel: "layout-shift không được hỗ trợ", value: 0 }] }); }
  });
}

/** (f) vùng chạm — chạy trong trình duyệt; kiểm tra cả vùng chạm mở rộng bằng ::before/::after hoặc <label> qua elementFromPoint. */
function auditTouch(min: number) {
  const ux = window.__ux;
  const main = document.querySelector("main");
  if (!main) return [];
  const els = Array.from(main.querySelectorAll('button, a[href], [role="button"], input[type="checkbox"]')) as HTMLElement[];
  const out: { sel: string; text: string; w: number; h: number }[] = [];
  const seen = new Set<Element>();
  for (const el of els) {
    if (seen.has(el)) continue; seen.add(el);
    if (ux.inThirdParty(el) || el.closest("p a") || el.matches("p a")) continue;
    if (!ux.visible(el) || getComputedStyle(el).pointerEvents === "none") continue;
    const r0 = el.getBoundingClientRect();
    if (r0.width >= min && r0.height >= min) continue;
    // label bọc checkbox / pseudo-element có thể nới vùng chạm → thử chạm 4 điểm quanh tâm
    el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" as ScrollBehavior });
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2, d = min / 2 - 1;
    const owns = (hit: Element | null) => {
      if (!hit) return false;
      if (hit === el || el.contains(hit)) return true;
      const labels = (el as HTMLInputElement).labels;
      return !!labels && Array.from(labels).some((l) => l === hit || l.contains(hit));
    };
    const pts: [number, number][] = [[cx - d, cy], [cx + d, cy], [cx, cy - d], [cx, cy + d]];
    if (pts.every(([x, y]) => owns(document.elementFromPoint(x, y)))) continue;
    out.push({ sel: ux.sel(el), text: ux.text(el, 40) || el.getAttribute("aria-label") || el.getAttribute("title") || "", w: Math.round(r.width), h: Math.round(r.height) });
  }
  window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  return out;
}

test.describe("layout × viewport", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Quét viewport chạy trên project chromium (tự đặt kích thước)");
    await installUxHelpers(page);
  });

  for (const p of UX_PAGES) {
    for (const w of VIEWPORTS) {
      test(`layout ${w}px: ${p.name}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width: w, height: VIEWPORT_HEIGHT[w] });
        const { url, status } = await gotoUx(page, p);
        expect(status, `HTTP ${url}`).toBe(200);
        await expect(page.locator("main")).toBeVisible();
        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
        await page.waitForTimeout(1000);
        const cls = await evalRetry(page, measureCls);
        await settle(page);
        if (p.key === "cluster-editor") await expect.poll(() => page.locator(".react-flow__node").count(), { timeout: 30_000 }).toBeGreaterThan(0);
        const a = await evalRetry(page, auditLayout);
        const stack = await evalRetry(page, auditStickyStack);

        const checks: Record<string, CheckResult> = {
          "a·page-overflow": { pass: !a.pageOverflow, items: a.pageOverflow ? [a.pageOverflow] : [] },
          "b·element-overflow": { pass: a.overflow.length === 0, items: a.overflow },
          "c·h1-clipped": { pass: a.h1Clipped.length === 0, items: a.h1Clipped },
          "d·sticky-overlap": { pass: a.stickyOverHeading.length === 0 && stack.length === 0, items: [...a.stickyOverHeading, ...stack], info: { heading: a.heading } },
          "e·cls": { pass: cls.cls < CLS_MAX, items: cls.cls < CLS_MAX ? [] : [cls], info: cls },
        };
        await recordUx(testInfo, { suite: "layout", page: p.key, pageName: p.name, variant: `${w}`, url, checks });

        expect.soft(a.pageOverflow, `(a) tràn ngang trang ${url} @${w}px`).toBeNull();
        expect.soft(a.overflow, `(b) phần tử tràn hộp ${url} @${w}px`).toEqual([]);
        expect.soft(a.h1Clipped, `(c) H1 bị cắt ${url} @${w}px`).toEqual([]);
        expect.soft(a.stickyOverHeading, `(d) sticky đè heading đầu tiên ${url} @${w}px`).toEqual([]);
        expect.soft(stack, `(d) các sticky chồng lên nhau khi cuộn ${url} @${w}px`).toEqual([]);
        expect.soft(cls.cls, `(e) CLS ${url} @${w}px — nguồn: ${JSON.stringify(cls.sources)}`).toBeLessThan(CLS_MAX);
      });
    }
  }
});

test.describe("vùng chạm (phone 390×844, hasTouch)", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "Kiểm tra vùng chạm chạy trên project phone (isMobile + hasTouch)");
    await installUxHelpers(page);
  });

  for (const p of UX_PAGES) {
    test(`touch ≥ ${TOUCH_MIN}px: ${p.name}`, async ({ page }, testInfo) => {
      const { url, status } = await gotoUx(page, p);
      expect(status, `HTTP ${url}`).toBe(200);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      await settle(page);
      const small = await evalRetry(page, auditTouch, TOUCH_MIN);
      await recordUx(testInfo, { suite: "layout", page: p.key, pageName: p.name, variant: "touch-390", url, checks: { "f·touch-target": { pass: small.length === 0, items: small } } });
      expect.soft(small, `(f) vùng chạm < ${TOUCH_MIN}×${TOUCH_MIN} trên ${url}:\n${small.map((s) => `- ${s.sel} "${s.text}" ${s.w}×${s.h}`).join("\n")}`).toEqual([]);
    });
  }
});
