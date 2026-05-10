import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

const require = createRequire("/Users/courtneymosely/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/");
const { chromium } = require("playwright");

const root = process.cwd();
const htmlPath = path.join(root, "contracts", "meridian-va-independent-contractor-agreement.html");
const pdfPath = path.join(root, "contracts", "meridian-va-independent-contractor-agreement.pdf");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1024, height: 1325 } });

await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
await page.pdf({
  path: pdfPath,
  format: "Letter",
  printBackground: true,
  preferCSSPageSize: true,
});

await browser.close();
console.log(pdfPath);
