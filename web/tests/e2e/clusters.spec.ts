import { DEMO, apiKeyNotice, expect, test } from "./fixtures";

test.describe("Topic Cluster", () => {
  test("danh sách cluster: cluster seed, cảnh báo cannibalization, form bị vô hiệu", async ({ page }) => {
    await page.goto(`/projects/${DEMO.projectId}/clusters`);
    await expect(apiKeyNotice(page)).toBeVisible();
    const list = page.getByRole("region", { name: "Cluster đã tạo" });
    await expect(list.getByRole("link", { name: /Hướng dẫn mua iPhone 17 Pro Max/i })).toBeVisible();
    await expect(page.getByRole("region", { name: "Cảnh báo cannibalization" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Xây Topic Cluster mới" })).toBeVisible();
  });

  test("editor: React Flow render ≥ 5 node và ≥ 5 edge, bảng node, trạng thái đã lưu", async ({ page }) => {
    await page.goto(`/projects/${DEMO.projectId}/clusters/${DEMO.clusterId}`);
    await expect(page.locator(".react-flow")).toBeVisible();
    await expect.poll(() => page.locator(".react-flow__node").count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(5);
    await expect.poll(() => page.locator(".react-flow__edge").count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(5);
    await expect(page.getByLabel("Tiêu đề pillar")).toHaveValue(/Hướng dẫn mua iPhone 17 Pro Max/i);
    await expect(page.getByText("Tất cả đã lưu")).toBeVisible();
  });

  test("editor: chọn node → panel bên phải hiện thuộc tính; sửa tiêu đề → trạng thái 'Chưa lưu thay đổi'", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Tương tác kéo/chọn node chỉ kiểm tra trên desktop");
    await page.goto(`/projects/${DEMO.projectId}/clusters/${DEMO.clusterId}`);
    await expect.poll(() => page.locator(".react-flow__node").count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(5);
    const node = page.locator(".react-flow__node").filter({ hasText: "Giá iPhone 17 Pro Max mới nhất" }).first();
    await node.click();
    const title = page.locator("#n-title");
    await expect(title).toHaveValue(/Giá iPhone 17 Pro Max mới nhất/);
    await expect(page.locator("#n-kw")).toHaveValue("giá iphone 17 pro max");
    await title.fill("Giá iPhone 17 Pro Max mới nhất (QA)");
    await expect(page.getByText("Chưa lưu thay đổi")).toBeVisible();
    // Nút tạo brief trên node bị vô hiệu (không có API key)
    await expect(page.getByRole("button", { name: /Tạo brief/i }).first()).toBeDisabled();
  });
});
