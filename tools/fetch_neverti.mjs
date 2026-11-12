// =========================================================
// tools/fetch_neverti.mjs
// Collects every product from the real Neverti store (neverti.com.sa).
//
// The store runs on Salla. Its pages load products with JavaScript from
// Salla's public storefront API — the same data a browser sees. We call
// that API directly, so no browser (Playwright) is needed.
//
// Run:   node tools/fetch_neverti.mjs
// Output: .tmp/neverti-raw.json  (raw data, can be regenerated anytime)
// =========================================================

import { mkdir, writeFile } from "node:fs/promises";

const API = "https://api.salla.dev/store/v1";
const HEADERS = {
  "Store-Identifier": "1515200385", // Neverti's Salla store id (from the store page)
  Accept: "application/json",
  "Accept-Language": "en",           // English names and descriptions
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { headers: HEADERS });
    if (res.ok) return res.json();
    console.warn(`  ${res.status} on ${url} (attempt ${attempt})`);
    await wait(1000 * attempt);
  }
  throw new Error(`Failed: ${url}`);
}

// Follow the "next" cursor until there are no more pages
async function getAllProducts(firstUrl, maxPages = Infinity) {
  const items = [];
  let url = firstUrl;
  let page = 0;
  while (url && page < maxPages) {
    const json = await getJSON(url);
    items.push(...(json.data || []));
    url = json.cursor?.next || null;
    page++;
    await wait(150); // be polite to the server
  }
  return items;
}

async function main() {
  console.log("1) Categories…");
  const categories = (await getJSON(`${API}/categories`)).data;

  // Flatten the tree: [{ id, name, parent }]
  const flat = [];
  for (const top of categories) {
    flat.push({ id: top.id_, slug: top.id, name: top.name, parent: null });
    for (const sub of top.sub_categories || []) {
      flat.push({ id: sub.id_, slug: sub.id, name: sub.name, parent: top.name });
    }
  }
  console.log(`   ${flat.length} categories`);

  console.log("2) Products in every category…");
  const products = {}; // id -> product (+ all its categories)
  for (const cat of flat) {
    const list = await getAllProducts(
      `${API}/products?source=categories&source_value[]=${cat.id}&per_page=15`
    );
    for (const p of list) {
      products[p.id] ??= { ...p, inCategories: [] };
      products[p.id].inCategories.push({ name: cat.name, parent: cat.parent });
    }
    console.log(`   ${cat.parent ? cat.parent + " › " : ""}${cat.name}: ${list.length}`);
  }

  console.log("3) Best sellers and newest (store order)…");
  const best = await getAllProducts(`${API}/products?source=sales&per_page=15`, 4);
  const latest = await getAllProducts(`${API}/products?source=latest&per_page=15`, 4);
  // Best-seller list also carries the real star ratings
  const bestRank = {};
  best.forEach((p, i) => {
    bestRank[p.id] = i + 1;
    if (products[p.id] && p.rating) products[p.id].rating = p.rating;
  });
  const latestRank = {};
  latest.forEach((p, i) => (latestRank[p.id] = i + 1));

  await mkdir(".tmp", { recursive: true });
  await writeFile(
    ".tmp/neverti-raw.json",
    JSON.stringify({ fetchedAt: new Date().toISOString(), categories: flat, products, bestRank, latestRank }, null, 1)
  );
  console.log(`Done: ${Object.keys(products).length} products → .tmp/neverti-raw.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
