const { chromium } = require("playwright");

const url = process.env.DEMO_URL || "http://127.0.0.1:5173/";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const pageErrors = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));

  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  
  console.log("Waiting for app-shell...");
  await page.locator(".app-shell").waitFor({ timeout: 30000 });

  // 1. Verify default Tab (Văn phòng Agent)
  console.log("Verifying 'Văn phòng Agent' tab...");
  await page.getByText("AI Marketing Manager").first().waitFor({ timeout: 5000 });
  await page.getByText("CAMPAIGN CONTROL ROOM").first().waitFor({ timeout: 5000 });

  // 2. Click 'Tổng quan' tab
  console.log("Navigating to 'Tổng quan' tab...");
  await page.getByRole("button", { name: "Tổng quan" }).click();
  await page.getByText("Sơ đồ luồng xử lý chiến dịch").first().waitFor({ timeout: 5000 });
  await page.getByText("Bàn phê duyệt chiến dịch").first().waitFor({ timeout: 5000 });

  // 3. Click 'Bảng Chiến dịch' tab
  console.log("Navigating to 'Bảng Chiến dịch' tab...");
  await page.getByRole("button", { name: "Bảng Chiến dịch" }).click();
  await page.getByText("Bảng điều hành Chiến dịch").first().waitFor({ timeout: 5000 });

  // 4. Click 'Đối thủ cạnh tranh' tab
  console.log("Navigating to 'Đối thủ cạnh tranh' tab...");
  await page.getByRole("button", { name: "Đối thủ cạnh tranh" }).click();
  await page.getByText("Giám sát Đối thủ Cạnh tranh").first().waitFor({ timeout: 5000 });
  await page.getByText("Phân tích Thị phần & Share of Voice").first().waitFor({ timeout: 5000 });

  // 5. Click 'Content & Video Studio' tab
  console.log("Navigating to 'Content & Video Studio' tab...");
  await page.getByRole("button", { name: "Content & Video Studio" }).click();
  await page.getByText("A/B Testing Copywriting").first().waitFor({ timeout: 5000 });
  await page.getByText("Video Storyboard").first().waitFor({ timeout: 5000 });

  // 6. Click 'Chăm sóc & Lead' tab
  console.log("Navigating to 'Chăm sóc & Lead' tab...");
  await page.getByRole("button", { name: "Chăm sóc & Lead" }).click();
  await page.getByText("Community Inbox").first().waitFor({ timeout: 5000 });

  // 7. Click 'Vận hành hệ thống' tab
  console.log("Navigating to 'Vận hành hệ thống' tab...");
  await page.getByRole("button", { name: "Vận hành hệ thống" }).click();
  await page.getByText("Vận hành hệ thống").first().waitFor({ timeout: 5000 });
  await page.getByText("Observability & API Endpoint telemetry").first().waitFor({ timeout: 5000 });

  if (pageErrors.length) {
    throw new Error(`Page errors detected during tab transitions: ${pageErrors.join(" | ")}`);
  }

  console.log("All 7 tabs verified successfully!");
  await page.screenshot({ path: "output/playwright/full-agent-workflow.png", fullPage: true });
  await browser.close();
  console.log(JSON.stringify({ ok: true, url, steps: 7, pageErrors }, null, 2));
})().catch(async (error) => {
  console.error("Smoke test failed:", error);
  process.exit(1);
});
