// Renders the app icon's sources to the PNGs the web app and the iOS app want.
// Usage: node scripts/render-icons.mjs [path-to-chromium]
// Needs Playwright; set PLAYWRIGHT_MODULE to its entry file if it isn't
// installed in this project (e.g. a global install).
//
// Web app (public/icons): the light icon at every size, plus a dark Home
// Screen icon. A web app can't switch icons with the appearance; index.html
// hands iOS the dark one when the phone is in dark mode at Add to Home Screen.
//
// iOS app (scripts/ios-app-icon): 1024 px Light, Dark and Tinted icons for an
// AppIcon set in the asset catalog. Light is opaque; Dark and Tinted have a
// clear background, because iOS draws the background behind those itself.
import { mkdirSync, readFileSync } from "node:fs";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const read = (name) => readFileSync(new URL(`./${name}`, import.meta.url), "utf8");
const light = read("icon.svg");
const dark = read("icon-dark.svg");
const tinted = read("icon-tinted.svg");
const withoutBackground = (svg) => svg.replace(/<rect id="background"[^>]*\/>/, "");

const outputs = [
  [light, 180, "public/icons/apple-touch-icon.png"],
  [dark, 180, "public/icons/apple-touch-icon-dark.png"],
  [light, 192, "public/icons/icon-192.png"],
  [light, 512, "public/icons/icon-512.png"],
  [light, 1024, "scripts/ios-app-icon/AppIcon.png"],
  [withoutBackground(dark), 1024, "scripts/ios-app-icon/AppIcon-Dark.png"],
  [tinted, 1024, "scripts/ios-app-icon/AppIcon-Tinted.png"],
];

mkdirSync("scripts/ios-app-icon", { recursive: true });
const browser = await chromium.launch({ executablePath: process.argv[2] });
const page = await browser.newPage();
for (const [svg, size, path] of outputs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  await page.screenshot({ path, omitBackground: true });
}
await browser.close();
