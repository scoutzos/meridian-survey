import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(
  "/Users/courtneymosely/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/",
);
const { chromium } = require("playwright");

const root = process.cwd();
const htmlPath = path.join(root, "Meridian_Land_Buildability_Due_Diligence_Checklist.html");
const pdfPath = path.join(root, "Meridian_Land_Buildability_Due_Diligence_Checklist.pdf");
const previewDir = path.join(root, ".tmp-meridian-pdf-preview");

await mkdir(previewDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1020, height: 1320 } });

await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
await page.pdf({
  path: pdfPath,
  format: "Letter",
  printBackground: true,
  preferCSSPageSize: true,
});

const pages = await page.locator(".page").all();
for (const [index, pageElement] of pages.entries()) {
  await pageElement.screenshot({
    path: path.join(previewDir, `page-${String(index + 1).padStart(2, "0")}.png`),
  });
}

await browser.close();
console.log(pdfPath);
