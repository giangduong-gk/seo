import { expect, test as base, type Page } from "@playwright/test";

/** Lỗi console được chấp nhận (không phải lỗi app). */
const IGNORED_CONSOLE = [/favicon/i, /Download the React DevTools/i];

export type CollectedErrors = { pageErrors: string[]; consoleErrors: string[] };

/**
 * Fixture tự động cho MỌI test: gom `pageerror` + `console.error`, và sau test kiểm tra
 * (a) không có lỗi, (b) trang không tràn ngang (scrollWidth ≤ innerWidth).
 */
export const test = base.extend<{ errors: CollectedErrors }>({
  errors: [
    async ({ page }, use) => {
      const errors: CollectedErrors = { pageErrors: [], consoleErrors: [] };
      page.on("pageerror", (e) => errors.pageErrors.push(e.message));
      page.on("console", (m) => {
        if (m.type() !== "error") return;
        const text = m.text();
        if (IGNORED_CONSOLE.some((r) => r.test(text))) return;
        // Điều hướng chủ ý tới trang 404: trình duyệt log "Failed to load resource ... 404" cho chính document → không phải lỗi app
        if (/Failed to load resource/.test(text) && m.location().url === page.url()) return;
        errors.consoleErrors.push(text);
      });
      await use(errors);
      if (!page.isClosed() && page.url() !== "about:blank") await expectNoHorizontalOverflow(page);
      expect.soft(errors.pageErrors, "pageerror").toEqual([]);
      expect.soft(errors.consoleErrors, "console.error").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export async function expectNoHorizontalOverflow(page: Page) {
  const m = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth, url: location.pathname }));
  expect.soft(m.scrollWidth, `tràn ngang tại ${m.url}: scrollWidth ${m.scrollWidth} > innerWidth ${m.innerWidth}`).toBeLessThanOrEqual(m.innerWidth);
}

/** Thông báo vàng "Chưa cấu hình ANTHROPIC_API_KEY" (SystemNotice role=status). */
export function apiKeyNotice(page: Page) {
  return page.getByRole("status").filter({ hasText: "Chưa cấu hình ANTHROPIC_API_KEY" });
}

export const DEMO = { projectId: "demo-project", clusterId: "demo-cluster", briefId: "demo-brief", projectName: "Điện Thoại Giá Kho" } as const;
