const { chromium } = require("playwright");

const url = process.env.DEMO_URL || "http://127.0.0.1:5174/";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const pageErrors = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.locator(".app-shell").waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: /Agents/ }).click();
  await page.getByRole("button", { name: /Run full agent flow/ }).click();
  await page.getByText("Agent Workflow Demo").waitFor({ timeout: 30000 });
  await page.getByText("CEO/PM Agent").first().waitFor();
  await page.getByText("Analytics Agent").first().waitFor();
  await page.getByText("Human approval gate").first().waitFor();

  const steps = await page.locator(".workflow-step").count();
  if (steps !== 8) {
    throw new Error(`Expected 8 workflow steps, received ${steps}`);
  }

  if (pageErrors.length) {
    throw new Error(`Page errors: ${pageErrors.join(" | ")}`);
  }

  await page.screenshot({ path: "output/playwright/full-agent-workflow.png", fullPage: true });
  await browser.close();
  console.log(JSON.stringify({ ok: true, url, steps, pageErrors }, null, 2));
})().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
