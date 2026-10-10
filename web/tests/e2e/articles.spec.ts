import { DEMO, apiKeyNotice, expect, test } from "./fixtures";

/** Sprint 3 — bỏ qua nếu route chưa tồn tại (404). */
test.describe("Bài viết (Sprint 3)", () => {
  test("danh sách bài viết render, form viết bài bị vô hiệu khi thiếu API key", async ({ page }) => {
    const res = await page.goto(`/projects/${DEMO.projectId}/articles`);
    test.skip(res?.status() === 404, "Route /articles chưa tồn tại (Sprint 3 đang viết)");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: DEMO.projectName })).toBeVisible();
    await expect(apiKeyNotice(page)).toBeVisible();
    await expect(page.getByRole("region", { name: "Viết bài mới" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Bài viết" })).toBeVisible();
    const write = page.getByRole("button", { name: /Viết bài/i }).first();
    if (await write.count()) await expect(write).toBeDisabled();
  });

  test("bài viết không tồn tại → 404", async ({ page }) => {
    const list = await page.goto(`/projects/${DEMO.projectId}/articles`);
    test.skip(list?.status() === 404, "Route /articles chưa tồn tại (Sprint 3 đang viết)");
    const res = await page.goto(`/projects/${DEMO.projectId}/articles/khong-ton-tai`);
    expect(res?.status()).toBe(404);
  });
});
