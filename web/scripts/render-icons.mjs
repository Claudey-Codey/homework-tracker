// Renders scripts/icon.svg, and its dark version scripts/icon-dark.svg, to
// the PNG sizes the manifest and iOS want.
// Usage: node scripts/render-icons.mjs [path-to-chromium]
// Needs Playwright; set PLAYWRIGHT_MODULE to its entry file if it isn't
// installed in this project (e.g. a global install).
import { readFileSync } from "node:fs";

const playwright = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
// A CommonJS entry file imported by path puts its exports under `default`.
const { chromium } = playwright.chromium ? playwright : playwright.default;
const read = (name) => readFileSync(new URL(`./${name}`, import.meta.url), "utf8");
const icons = [
  ["icon.svg", "apple-touch-icon", 180],
  ["icon.svg", "icon-192", 192],
  ["icon.svg", "icon-512", 512],
  // iOS only uses the dark one as the Home Screen icon (see index.html).
  ["icon-dark.svg", "apple-touch-icon-dark", 180],
];
const browser = await chromium.launch({ executablePath: process.argv[2] });
const page = await browser.newPage();
for (const [source, name, size] of icons) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${read(source)}`,
  );
  await page.screenshot({ path: `public/icons/${name}.png` });
}
await browser.close();
