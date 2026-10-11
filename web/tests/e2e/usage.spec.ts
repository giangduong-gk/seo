import { expect, test } from "./fixtures";

test("trang Chi phí AI: KPI (Stat) tổng chi phí, biểu đồ theo tính năng, bảng theo dự án và theo tính năng", async ({ page }) => {
  await page.goto("/usage");
  await expect(page.getByRole("heading", { level: 1, name: "Chi phí AI" })).toBeVisible();
  // KPI dạng <Stat> (nhãn → giá trị → chú thích), không còn là region
  const stat = (label: string) => page.locator(".grid-kpi").getByText(label, { exact: true }).locator("xpath=..");
  await expect(stat("Tổng chi phí")).toContainText("$");
  await expect(stat("Lần gọi")).toContainText(/\d/);
  await expect(stat("Token vào / ra")).toContainText("/");
  await expect(stat("Tỷ lệ cache hit")).toContainText("%");
  const bars = page.getByRole("region", { name: "Chi phí theo tính năng" }).getByRole("img");
  await expect(bars).toContainText("Phân tích từ khoá");
  await expect(bars).toContainText("$");
  await expect(page.getByRole("region", { name: "Theo dự án" }).getByRole("table")).toBeVisible();
  await expect(page.getByRole("region", { name: "Theo tính năng & model" }).getByRole("table")).toContainText("Phân tích từ khoá");
});
