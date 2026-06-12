import fs from "node:fs/promises";
import path from "node:path";

const playwrightModule = process.env.PLAYWRIGHT_MODULE || "playwright";
const playwright = await import(playwrightModule);
const { chromium } = playwright.chromium ? playwright : playwright.default;

const baseURL = process.env.QA_BASE_URL || "http://127.0.0.1:5173";
const outDir = path.resolve("artifacts/browser-qa/termflow-mvp");
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });

const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") {
    consoleErrors.push(msg.text());
  }
});

const failedRequests = [];
page.on("requestfailed", (request) => {
  failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ""}`);
});

await page.goto(baseURL, { waitUntil: "networkidle" });
await page.screenshot({ path: path.join(outDir, "desktop-shell.png"), fullPage: true });

await page.getByText("Offline preview").first().waitFor({ timeout: 5000 });
await page.getByText("No active SSH session").waitFor({ timeout: 5000 });
await page.getByText("No connections").waitFor({ timeout: 5000 });

await page.getByRole("button", { name: "Create connection" }).click();
await page.getByText("New SSH connection").waitFor({ timeout: 5000 });
await page.screenshot({ path: path.join(outDir, "connection-modal.png"), fullPage: true });

await page.getByRole("textbox", { name: "Name", exact: true }).fill("local-test");
await page.getByLabel("Host").fill("127.0.0.1");
await page.getByLabel("Port").fill("22");
await page.getByRole("textbox", { name: "Username", exact: true }).fill("tester");
await page.screenshot({ path: path.join(outDir, "connection-form-filled.png"), fullPage: true });

await browser.close();

if (consoleErrors.length || failedRequests.length) {
  console.error(JSON.stringify({ consoleErrors, failedRequests }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      screenshots: [
        "artifacts/browser-qa/termflow-mvp/desktop-shell.png",
        "artifacts/browser-qa/termflow-mvp/connection-modal.png",
        "artifacts/browser-qa/termflow-mvp/connection-form-filled.png",
      ],
    },
    null,
    2,
  ),
);
