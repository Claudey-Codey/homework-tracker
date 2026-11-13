// Renders scripts/icon.svg to the PNG sizes the manifest and iOS want.
// Usage: node scripts/render-icons.mjs [path-to-chromium]
// Needs Playwright; set PLAYWRIGHT_MODULE to its entry file if it isn't
// installed in this project (e.g. a global install).
import { readFileSync } from "node:fs";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const svg = readFileSync(new URL("./icon.svg", import.meta.url), "utf8");
const browser = await chromium.launch({ executablePath: process.argv[2] });
const page = await browser.newPage();
for (const [name, size] of [["apple-touch-icon", 180], ["icon-192", 192], ["icon-512", 512]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  await page.screenshot({ path: `public/icons/${name}.png` });
}
await browser.close();
