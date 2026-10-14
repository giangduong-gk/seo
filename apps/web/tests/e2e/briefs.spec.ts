import { DEMO, apiKeyNotice, expect, test } from "./fixtures";

test.describe("Content Brief", () => {
  test("danh sách brief: brief seed hiển thị, form bị vô hiệu", async ({ page }) => {
    await page.goto(`/projects/${DEMO.projectId}/briefs`);
    await expect(apiKeyNotice(page)).toBeVisible();
    await expect(page.getByRole("region", { name: "Brief đã tạo" }).getByRole("link", { name: /Trả góp iPhone 17 Pro Max/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Tạo brief/i }).first()).toBeDisabled();
  });

  test("trang brief: outline answer-first, E-E-A-T, checklist, FAQ, nút tải Markdown", async ({ page }) => {
    await page.goto(`/projects/${DEMO.projectId}/briefs/${DEMO.briefId}`);
    await expect(page.getByRole("heading", { level: 1, name: /Trả góp iPhone 17 Pro Max/i })).toBeVisible();
    // Panel outline (section#outline). Tên region "Outline" đang TRÙNG với ô KPI cùng tên — lỗi a11y được bắt riêng
    // bởi gate "tên landmark duy nhất" trong a11y.spec.ts, nên ở đây định vị panel theo id.
    const outline = page.locator("section#outline");
    await expect(outline).toBeVisible();
    await expect.poll(() => outline.locator("ol > li").count()).toBeGreaterThanOrEqual(5);
    await expect(outline.getByText("H1", { exact: true }).first()).toBeVisible();
    await expect(outline.getByText(/Answer-first/i).first()).toBeVisible();
    for (const name of ["E-E-A-T", "Checklist GEO", "Schema JSON-LD", "Multi-format", "Liên kết", "Không được", "FAQ nháp"]) {
      await expect(page.getByRole("region", { name })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "Copy Markdown" })).toBeVisible();
    const dl = page.getByRole("link", { name: /Tải Markdown/i });
    await expect(dl).toHaveAttribute("href", `/api/briefs/${DEMO.briefId}/markdown?download=1`);
  });

  test("API /api/briefs/demo-brief/markdown trả Markdown '# Content Brief'; ?download=1 có Content-Disposition", async ({ request }) => {
    const res = await request.get(`/api/briefs/${DEMO.briefId}/markdown`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/text\/markdown/);
    const md = await res.text();
    expect(md.startsWith("# Content Brief")).toBe(true);
    expect(md).toContain("## Outline");
    expect(md).toContain(`> Dự án: ${DEMO.projectName}`);

    const dl = await request.get(`/api/briefs/${DEMO.briefId}/markdown?download=1`);
    expect(dl.status()).toBe(200);
    expect(dl.headers()["content-disposition"]).toMatch(/attachment; filename="brief-.*\.md"/);

    const missing = await request.get(`/api/briefs/khong-co/markdown`);
    expect(missing.status()).toBe(404);
  });
});
