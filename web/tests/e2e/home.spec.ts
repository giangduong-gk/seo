import { DEMO, apiKeyNotice, expect, test } from "./fixtures";

test.describe("Trang chủ", () => {
  test("hiển thị wordmark SEO Studio, thông báo thiếu API key và danh sách dự án seed", async ({ page }) => {
    await page.goto("/");
    const wordmark = page.getByRole("link", { name: "SEO Studio — trang chủ" });
    await expect(wordmark).toBeVisible();
    await expect(wordmark.locator("b")).toHaveText("SEO");
    await expect(page.getByRole("heading", { level: 1, name: "Dự án" })).toBeVisible();
    await expect(apiKeyNotice(page)).toBeVisible();
    const list = page.getByRole("region", { name: "Dự án hiện có" });
    await expect(list.getByRole("link", { name: new RegExp(DEMO.projectName) })).toBeVisible();
    await expect(page.getByRole("region", { name: "Tạo dự án mới" })).toBeVisible();
  });

  test("tạo dự án qua form và chuyển tới trang dự án", async ({ page }) => {
    const name = `QA Dự án ${Date.now()}`;
    await page.goto("/");
    await page.getByLabel("Tên dự án").fill(name);
    await page.getByLabel("Domain").fill("qa.example.vn");
    await page.getByLabel("Ngành").fill("QA");
    await page.getByRole("button", { name: "Tạo dự án" }).click();
    await page.waitForURL(/\/projects\/[a-z0-9]+$/i);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByText("qa.example.vn · QA · vi-VN")).toBeVisible();
    // Dự án mới chưa có phân tích → empty state
    await expect(page.getByText("Chưa có phân tích")).toBeVisible();
  });

  test("validate: tên quá ngắn → báo lỗi, không chuyển trang", async ({ page }) => {
    await page.goto("/");
    const input = page.getByLabel("Tên dự án");
    await input.fill("A");
    // Bỏ qua validate HTML (minLength) để kiểm tra validate server (zod)
    await input.evaluate((el) => (el as HTMLInputElement).removeAttribute("minlength"));
    await page.getByRole("button", { name: "Tạo dự án" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "tối thiểu 2 ký tự" })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/");
  });
});
