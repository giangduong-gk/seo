import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * E2E smoke — chạy dev server riêng trên cổng 3500 với DB SQLite riêng (prisma/test.db) và KHÔNG có API key
 * (UI hiển thị thông báo vàng, nút sinh nội dung bị vô hiệu → không gọi Claude thật).
 *
 * Lưu ý env: `@next/env` chụp process.env lúc khởi động và không cho .env ghi đè khoá đã có mặt — kể cả chuỗi rỗng —
 * nên `ANTHROPIC_API_KEY=""` ở đây thắng giá trị trong web/.env. Prisma CLI/Client cũng ưu tiên process.env hơn .env.
 */
const PORT = Number(process.env.E2E_PORT || 3500);
const BASE_URL = `http://localhost:${PORT}`;

// Máy dev/CI nội bộ có sẵn Chromium tại đây (PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1). Trên CI công khai dùng `npx playwright install chromium`.
const LOCAL_CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const executablePath = process.env.PW_CHROME_PATH || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
const launchOptions = executablePath ? { executablePath } : {};

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.spec\.ts/,
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 120_000, // dev server biên dịch từng route lần đầu khá chậm
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  outputDir: "./test-results",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    navigationTimeout: 90_000,
    actionTimeout: 20_000,
  },
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,
    env: {
      DATABASE_URL: "file:./test.db",
      ANTHROPIC_API_KEY: "",
      ENABLE_WEB_SEARCH: "false",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], launchOptions },
    },
    {
      // iPhone 13-like nhưng chạy bằng Chromium (không tải WebKit)
      name: "phone",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent: devices["iPhone 13"].userAgent,
        launchOptions,
      },
    },
  ],
});
