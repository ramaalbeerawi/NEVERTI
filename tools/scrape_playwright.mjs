// =========================================================
// tools/scrape_playwright.mjs — read the real store pages in a real browser
//
// Opens every category page of https://neverti.com.sa in Microsoft Edge (through
// Playwright), scrolls and presses "Load more" until nothing new loads, and records every product the page
// loads (the page loads them with JavaScript, so a plain download shows none).
// Then it compares with the catalog the site uses, so you can see nothing is missing.
//
// (tools/fetch_neverti.mjs gets the same data straight from the store's product
//  feed, which is faster. This one proves the real pages show the same products.)
//
// Run: node tools/scrape_playwright.mjs
// Output: .tmp/playwright-seen.json and a coverage report
// =========================================================

import { chromium } from "playwright-core";
import { readFile, writeFile } from "node:fs/promises";

const raw = JSON.parse(await readFile(".tmp/neverti-raw.json", "utf8"));
const known = new Set(Object.keys(raw.products));
const seen = new Map(); // product id → { name, price, category }

const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "en-US" });
const page = await context.newPage();

// Every product list the page loads passes through here
page.on("response", async (res) => {
  if (!/api\.salla\.dev\/store\/v1\/products/.test(res.url()) || !res.ok()) return;
  try {
    const json = await res.json();
    for (const p of json.data || []) {
      if (p?.id && !seen.has(p.id)) seen.set(p.id, { name: p.name, price: p.price, regular_price: p.regular_price, category: p.category?.name });
    }
  } catch { /* not a product list */ }
});

const categories = raw.categories;
for (const cat of categories) {
  const before = seen.size;
  await page.goto(`https://neverti.com.sa/en/category/${cat.slug}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  // The page shows 15 products, then a "Load more" button. Scroll to it and press it
  // until it goes away (or nothing new arrives).
  let idle = 0;
  for (let i = 0; i < 40 && idle < 3; i++) {
    const count = seen.size;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const more = page.getByRole("button", { name: /load more/i }).first();
    if (await more.isVisible().catch(() => false)) await more.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(1500);
    idle = seen.size === count ? idle + 1 : 0;
  }
  console.log(`${(cat.parent ? cat.parent + " › " : "") + cat.name}: +${seen.size - before} products`);
}

await browser.close();
await writeFile(".tmp/playwright-seen.json", JSON.stringify([...seen.entries()], null, 1));

const found = [...known].filter((id) => seen.has(id)).length;
console.log(`\nThe real pages showed ${seen.size} products.`);
console.log(`${found} of the ${known.size} products in our catalog were seen on the real pages.`);
const missing = [...known].filter((id) => !seen.has(id));
if (missing.length) console.log("Not seen on the pages (may be hidden or paged differently):", missing.length);
