// =========================================================
// tools/fetch_neverti_ar.mjs
// Fetches the ARABIC name and description of every product, so the finish of each
// product can be checked in both languages (FINAL_UPDATE_PROMPT.md section 2.2).
// Run: node tools/fetch_neverti_ar.mjs     → .tmp/neverti-ar.json
// =========================================================

import { readFile, writeFile } from "node:fs/promises";

const API = "https://api.salla.dev/store/v1";
const HEADERS = { "Store-Identifier": "1515200385", Accept: "application/json", "Accept-Language": "ar" };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(url) {
  for (let i = 1; i <= 3; i++) {
    const res = await fetch(url, { headers: HEADERS });
    if (res.ok) return res.json();
    await wait(800 * i);
  }
  throw new Error("Failed: " + url);
}

const raw = JSON.parse(await readFile(".tmp/neverti-raw.json", "utf8"));
const out = {};
// Only the top-level categories are needed: they contain every product
for (const cat of raw.categories.filter((c) => !c.parent)) {
  let url = `${API}/products?source=categories&source_value[]=${cat.id}&per_page=15`;
  while (url) {
    const json = await getJSON(url);
    for (const p of json.data || []) out[p.id] = { name: p.name, description: (p.description || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim() };
    url = json.cursor?.next || null;
    await wait(120);
  }
  console.log(cat.name, Object.keys(out).length);
}
await writeFile(".tmp/neverti-ar.json", JSON.stringify(out, null, 1));
const known = Object.keys(raw.products);
console.log(`Arabic text for ${known.filter((id) => out[id]).length} of ${known.length} products`);
