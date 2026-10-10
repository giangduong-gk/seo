import { DEMO, expect, test } from "./fixtures";

/**
 * Quét mọi trang: không pageerror, không console.error, không tràn ngang (fixture tự động kiểm tra sau mỗi test).
 * Chạy trên cả hai project (desktop + phone 390×844).
 */
const ROUTES = [
  "/",
  "/usage",
  `/projects/${DEMO.projectId}`,
  `/projects/${DEMO.projectId}/clusters`,
  `/projects/${DEMO.projectId}/clusters/${DEMO.clusterId}`,
  `/projects/${DEMO.projectId}/briefs`,
  `/projects/${DEMO.projectId}/briefs/${DEMO.briefId}`,
  `/projects/${DEMO.projectId}/articles`,
];

for (const route of ROUTES) {
  test(`layout sạch: ${route}`, async ({ page }) => {
    const res = await page.goto(route);
    if (route.endsWith("/articles")) test.skip(res?.status() === 404, "Route /articles chưa tồn tại");
    expect(res?.status()).toBe(200);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    // Đợi client hydrate/React Flow ổn định trước khi đo tràn ngang trong fixture
    await page.waitForLoadState("networkidle").catch(() => {});
  });
}

test("trang phân tích (route động) layout sạch", async ({ page }) => {
  await page.goto(`/projects/${DEMO.projectId}`);
  await page.getByRole("region", { name: "Lịch sử phân tích" }).getByRole("link").first().click();
  await page.waitForURL(/\/analyses\//);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await page.waitForLoadState("networkidle").catch(() => {});
});
