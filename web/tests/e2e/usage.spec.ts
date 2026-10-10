import { expect, test } from "./fixtures";

test("trang Chi phí AI: KPI tổng chi phí, bảng theo dự án và theo tính năng", async ({ page }) => {
  await page.goto("/usage");
  await expect(page.getByRole("heading", { level: 1, name: "Chi phí AI" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Tổng chi phí" })).toContainText("$");
  await expect(page.getByRole("region", { name: "Token vào / ra" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Tỷ lệ cache hit" })).toContainText("%");
  await expect(page.getByRole("region", { name: "Theo dự án" }).getByRole("table")).toBeVisible();
  await expect(page.getByRole("region", { name: "Theo tính năng & model" }).getByRole("table")).toContainText("keyword_analysis");
});
