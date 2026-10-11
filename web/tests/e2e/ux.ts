import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Page, TestInfo } from "@playwright/test";
import { DEMO } from "./fixtures";

/**
 * Hạ tầng dùng chung cho bộ UX gate (a11y · layout · motion · keyboard · visual).
 * - `UX_PAGES`: danh sách trang được quét (đủ 10 loại trang của app).
 * - `gotoUx` / `settle`: điều hướng + đợi trang "đứng yên" (network idle, font, animation hữu hạn xong).
 * - `recordUx`: ghi kết quả từng check ra `test-results/ux-report/*.json` (+ đính kèm vào test) để
 *   `node tools/ux-report.mjs` gộp thành bảng trang × check (baseline / so sánh sau redesign).
 * - `installUxHelpers`: tiêm `window.__ux` (tạo selector dễ đọc, lấy đoạn text) vào mọi trang.
 */

export type UxPage = { key: string; name: string; path: string | (() => Promise<string> | string); long?: boolean; toc?: boolean };

const P = `/projects/${DEMO.projectId}`;

/** Id phân tích seed là cuid ngẫu nhiên: global-setup đặt E2E_ANALYSIS_ID; dự phòng đọc link từ trang dự án. */
let analysisPathCache: string | null = null;
async function analysisPath(): Promise<string> {
  if (process.env.E2E_ANALYSIS_ID) return `${P}/analyses/${process.env.E2E_ANALYSIS_ID}`;
  if (analysisPathCache) return analysisPathCache;
  const base = `http://localhost:${process.env.E2E_PORT || 3500}`;
  const html = await (await fetch(base + P)).text();
  const m = html.match(new RegExp(`${P}/analyses/[a-z0-9]+`, "i"));
  if (!m) throw new Error("Không tìm thấy link phân tích trên trang dự án");
  analysisPathCache = m[0];
  return m[0];
}

export const UX_PAGES: UxPage[] = [
  { key: "home", name: "Trang chủ", path: "/" },
  { key: "project", name: "Dự án", path: P },
  { key: "analysis", name: "Phân tích", path: analysisPath, long: true, toc: true },
  { key: "clusters", name: "DS cluster", path: `${P}/clusters` },
  { key: "cluster-editor", name: "Editor cluster", path: `${P}/clusters/${DEMO.clusterId}` },
  { key: "briefs", name: "DS brief", path: `${P}/briefs` },
  { key: "brief", name: "Brief", path: `${P}/briefs/${DEMO.briefId}`, long: true, toc: true },
  { key: "articles", name: "DS bài viết", path: `${P}/articles` },
  { key: "article-editor", name: "Editor bài viết", path: `${P}/articles/${DEMO.articleId}`, long: true },
  { key: "usage", name: "Chi phí AI", path: "/usage" },
];

export async function resolvePath(p: UxPage): Promise<string> {
  return typeof p.path === "string" ? p.path : await p.path();
}

/** Đợi trang ổn định: load → networkidle (tối đa 10s) → font → animation hữu hạn trên DocumentTimeline xong (tối đa 3s). */
export async function settle(page: Page, opts: { maxAnimMs?: number } = {}) {
  await page.waitForLoadState("load");
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.evaluate(async (maxAnimMs) => {
    await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
    const finite = document.getAnimations().filter((a) => {
      const t = a.effect?.getComputedTiming();
      return !!t && t.endTime !== Infinity && a.timeline instanceof DocumentTimeline && a.playState === "running";
    });
    await Promise.race([Promise.all(finite.map((a) => a.finished.catch(() => undefined))), new Promise((r) => setTimeout(r, maxAnimMs))]);
  }, opts.maxAnimMs ?? 3000);
}

export async function gotoUx(page: Page, p: UxPage) {
  const url = await resolvePath(p);
  const res = await page.goto(url);
  return { url, status: res?.status() ?? 0 };
}

export type CheckResult = { pass: boolean; skipped?: string; items: unknown[]; info?: unknown };
export type UxRecord = { suite: string; page: string; pageName: string; variant: string; url?: string; checks: Record<string, CheckResult> };

export const UX_REPORT_DIR = path.resolve(__dirname, "..", "..", "test-results", "ux-report");

/** Ghi kết quả ra file JSON (cho tools/ux-report.mjs) và đính kèm vào test. */
export async function recordUx(testInfo: TestInfo, rec: UxRecord) {
  mkdirSync(UX_REPORT_DIR, { recursive: true });
  const file = path.join(UX_REPORT_DIR, `${rec.suite}__${rec.page}__${rec.variant}.json`.replace(/[^\w.-]+/g, "_"));
  writeFileSync(file, JSON.stringify(rec, null, 2));
  await testInfo.attach(`${rec.suite}-${rec.page}-${rec.variant}.json`, { body: JSON.stringify(rec, null, 2), contentType: "application/json" });
}

declare global {
  interface Window {
    __ux: {
      sel: (el: Element | null) => string;
      text: (el: Element | null, n?: number) => string;
      visible: (el: Element) => boolean;
      inThirdParty: (el: Element) => boolean;
    };
  }
}

/** Hàm chạy trong trình duyệt (addInitScript) — phải tự chứa, không tham chiếu biến ngoài. */
function uxBrowserHelpers() {
  const short = (el: Element) => {
    let s = el.tagName.toLowerCase();
    if (el.id) return `${s}#${el.id}`;
    const role = el.getAttribute("role");
    const label = el.getAttribute("aria-label");
    const cls = Array.from(el.classList).slice(0, 2).map((c) => "." + c.replace(/^(\w+)-module__\w+__/, "$1__")); // CSS module: Shell-module__abc__header → Shell__header
    s += cls.join("");
    if (role) s += `[role=${role}]`;
    if (label) s += `[aria-label="${label.slice(0, 30)}"]`;
    return s;
  };
  window.__ux = {
    sel(el) {
      if (!el) return "(null)";
      const parts: string[] = [];
      let cur: Element | null = el;
      while (cur && parts.length < 4 && cur !== document.body) {
        parts.unshift(short(cur));
        if (cur.id) break;
        cur = cur.parentElement;
      }
      return parts.join(" > ");
    },
    text(el, n = 60) {
      if (!el) return "";
      const t = ((el as HTMLElement).innerText ?? el.textContent ?? "").replace(/\s+/g, " ").trim();
      return t.length > n ? t.slice(0, n) + "…" : t;
    },
    visible(el) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return false;
      const cs = getComputedStyle(el);
      return cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.01;
    },
    /** Nội bộ React Flow / overlay dev của Next — bên thứ ba, không do app kiểm soát. */
    inThirdParty(el) {
      return !!el.closest(".react-flow, nextjs-portal");
    },
  };
}

export async function installUxHelpers(page: Page) {
  await page.addInitScript(uxBrowserHelpers);
}

/** Trang có nội dung "dài" đủ để cuộn ≥ n màn hình không. */
export async function pageHeightInViewports(page: Page) {
  return page.evaluate(() => document.documentElement.scrollHeight / window.innerHeight);
}

export const VIEWPORTS = [360, 768, 1024, 1440] as const;
