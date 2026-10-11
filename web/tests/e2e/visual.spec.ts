import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "./fixtures";
import { UX_PAGES, gotoUx, settle } from "./ux";

/**
 * Baseline hình ảnh để NGƯỜI xem lại (không phải snapshot assertion — UI đang thay đổi):
 * chụp full-page mọi trang ở 1440px (project chromium) và 390px (project phone, isMobile + touch),
 * lưu ở test-results/visual/<trang>-<width>.png và đính kèm vào test (xem trong HTML report).
 * Chạy với reduced-motion để ảnh chụp ở trạng thái cuối, không dính giữa animation.
 */
const OUT = path.resolve(__dirname, "..", "..", "test-results", "visual");

for (const p of UX_PAGES) {
  test(`visual: ${p.name}`, async ({ page }, testInfo) => {
    const width = testInfo.project.name === "phone" ? 390 : 1440;
    if (testInfo.project.name !== "phone") await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const { status } = await gotoUx(page, p);
    expect(status).toBe(200);
    await settle(page);
    if (p.key === "cluster-editor") await expect.poll(() => page.locator(".react-flow__node").count(), { timeout: 30_000 }).toBeGreaterThan(0);
    mkdirSync(OUT, { recursive: true });
    const file = path.join(OUT, `${p.key}-${width}.png`);
    const body = await page.screenshot({ path: file, fullPage: true, animations: "disabled", caret: "initial", mask: [page.locator("nextjs-portal")] });
    await testInfo.attach(`${p.key}-${width}.png`, { body, contentType: "image/png" });
  });
}
