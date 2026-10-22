// Renders every img/*.svg to img/*.png at 2x for sharp text.
import { chromium } from "playwright";
import { readdirSync, readFileSync } from "node:fs";

const dir = process.argv[2] || "/work/img";
const only = process.argv[3];
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
for (const f of readdirSync(dir).filter((f) => f.endsWith(".svg"))) {
  if (only && !f.startsWith(only)) continue;
  const svg = readFileSync(`${dir}/${f}`, "utf8");
  const w = Number(/width="(\d+)"/.exec(svg)[1]);
  const h = Number(/height="(\d+)"/.exec(svg)[1]);
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await page.locator("svg").screenshot({ path: `${dir}/${f.replace(/\.svg$/, ".png")}`, omitBackground: true });
  console.log("rendered", f);
}
await browser.close();
