// =========================================================
// tools/contact_sheet.mjs — one big photo per shade, side by side, to judge the finish
// (matte / gloss / shimmer / cream …) from the swatch smear.
// Run: node tools/contact_sheet.mjs <product-id> [<product-id> …]
// Output: .tmp/shots/contact.png
// =========================================================

import { startServer, launch, openPage } from "./check_pages.mjs";

const ids = process.argv.slice(2);
const server = await startServer();
const browser = await launch();
const { page, context } = await openPage(browser, "index.html?intro=0", { width: 1600, height: 900 });
await page.waitForTimeout(500);
const html = await page.evaluate(async (ids) => {
  const { LINES } = await import("/js/products-data.js");
  return ids.map((id) => {
    const line = LINES.find((l) => l.id === id);
    if (!line) return "";
    // up to 4 shades, spread across the list
    const n = line.shades.length;
    const pick = [0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1].filter((v, i, a) => a.indexOf(v) === i);
    return `<div class="row"><b>${line.name}</b>${pick.map((i) => `<figure><img src="/${line.shades[i].image}"><figcaption>${line.shades[i].name || ""}</figcaption></figure>`).join("")}</div>`;
  }).join("");
}, ids);
await page.setContent(`<style>body{margin:0;font:12px system-ui;background:#fff}.row{display:flex;align-items:center;border-bottom:1px solid #ddd}b{width:170px;padding:6px}figure{margin:0}img{width:210px;height:210px;object-fit:contain}figcaption{text-align:center}</style>${html}`);
await page.waitForFunction(() => [...document.images].every((i) => i.complete));
await page.screenshot({ path: ".tmp/shots/contact.png", fullPage: true });
await context.close();
await browser.close();
server.close();
