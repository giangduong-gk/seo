import { DEMO, apiKeyNotice, expect, test } from "./fixtures";

test.describe("Trang dự án & phân tích", () => {
  test("trang dự án: header, sub-nav, thông báo API key, form phân tích bị vô hiệu, lịch sử có phân tích seed", async ({ page }) => {
    await page.goto(`/projects/${DEMO.projectId}`);
    await expect(page.getByRole("heading", { level: 1, name: DEMO.projectName })).toBeVisible();
    await expect(apiKeyNotice(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "Phân tích" })).toBeDisabled();
    await expect(page.getByLabel("Từ khoá hoặc chủ đề")).toBeDisabled();
    const history = page.getByRole("region", { name: "Lịch sử phân tích" });
    await expect(history.getByRole("link", { name: /iphone 17 pro max giá bao nhiêu/i })).toBeVisible();
    for (const label of ["Phân tích từ khoá", "Topic Cluster", "Content Brief", "Bài viết"]) {
      await expect(page.getByRole("link", { name: new RegExp(label) }).first()).toBeVisible();
    }
  });

  test("trang phân tích: KPI panels, chip từ khoá ngữ nghĩa, bảng thực thể, checklist GEO", async ({ page }) => {
    await page.goto(`/projects/${DEMO.projectId}`);
    await page.getByRole("region", { name: "Lịch sử phân tích" }).getByRole("link").first().click();
    await page.waitForURL(/\/analyses\/[a-z0-9]+$/i);
    await expect(page.getByRole("heading", { level: 1, name: /iphone 17 pro max giá bao nhiêu/i })).toBeVisible();
    // Hàng KPI "Tổng quan" (4 ô): Ý định · Khối lượng tìm kiếm · Độ khó · Nguồn dữ liệu
    const kpi = page.getByRole("region", { name: "Tổng quan" });
    for (const name of ["Ý định", "Khối lượng tìm kiếm", "Độ khó", "Nguồn dữ liệu"]) await expect(kpi.getByRole("region", { name, exact: true })).toBeVisible();
    await expect(kpi.getByRole("region", { name: "Độ khó" }).getByText("62")).toBeVisible();
    // Định dạng đề xuất + Đối tượng nằm trong panel "Ý định & góc viết"
    const angle = page.getByRole("region", { name: "Ý định & góc viết" });
    await expect(angle).toBeVisible();
    await expect(angle.getByText("Định dạng đề xuất")).toBeVisible();
    await expect(angle.getByText("Đối tượng", { exact: true })).toBeVisible();
    // Chips
    const chips = page.getByRole("region", { name: "Từ khoá ngữ nghĩa" }).locator('span[class*="chip" i]');
    await expect.poll(() => chips.count()).toBeGreaterThanOrEqual(5);
    await expect(page.getByRole("region", { name: "Thực thể & Schema" }).getByRole("table")).toBeVisible();
    await expect(page.getByRole("region", { name: "Checklist GEO / E-E-A-T" })).toBeVisible();
    await expect(page.getByRole("region", { name: "FAQ nháp" })).toBeVisible();
    // Nút tạo brief bị vô hiệu vì không có API key
    await expect(page.getByRole("button", { name: /Tạo brief/i }).first()).toBeDisabled();
  });

  test("dự án không tồn tại → 404", async ({ page }) => {
    const res = await page.goto("/projects/khong-ton-tai");
    expect(res?.status()).toBe(404);
  });
});
