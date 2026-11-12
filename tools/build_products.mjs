// =========================================================
// tools/build_products.mjs
// Turns the raw store data (.tmp/neverti-raw.json) into the site catalog:
//   1. groups shades of the same product (by the store code, e.g. NP804.105)
//   2. cleans names, types and descriptions
//   3. downloads one photo per shade into assets/images/products/
//   4. writes js/products-data.js  (generated — don't edit by hand)
//
// Run after fetch_neverti.mjs:   node tools/build_products.mjs
// =========================================================

import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { FINISHES, NO_TRYON, FINISH_LABEL } from "./product-finishes.mjs";

const raw = JSON.parse(await readFile(".tmp/neverti-raw.json", "utf8"));
// Arabic names and descriptions (tools/fetch_neverti_ar.mjs), for the finish checks
let arText = {};
try { arText = JSON.parse(await readFile(".tmp/neverti-ar.json", "utf8")); } catch { /* optional */ }
const IMG_DIR = "assets/images/products";

// ---------- Hand-made fixes for messy names in the store ----------
// Some groups use slightly different product names per shade, so we give
// the clean line name and remove its words to find the shade name.
// name = clean line name · strip = extra words to remove from shade names
const LINE_OVERRIDES = {
  "101": { name: "Eyebrow Styler Liner", strip: ["Eye", "Brow", "Line"] },
  "202": { name: "Creamy Dimension Waterproof Powder" },
  "204": { name: "Creamy Dimension Contrast Contour", strip: ["Waterproof"] },
  "315": { name: "Contour Balm Stick" },
  "600": { name: "BrowTastic Eyebrow Gel" },
  "702": { name: "Let Lip Rejoice Lipstick", strip: ["Lipsticl"] },
};
const NO_GROUP = new Set(["150", "151", "300"]); // brushes + primers are separate products
const CODE_ALIAS = { "05": "705" };              // store typo: NP05.102 belongs to NP705

// Small spelling fixes (store data → site copy)
const TYPOS = {
  Woterproof: "Waterproof", Espesso: "Espresso", Moroccon: "Moroccan",
  Rosberry: "Raspberry", Sinnamon: "Cinnamon", Ket: "Kit",
  Touth: "Touch", Daer: "Dare", Prave: "Brave", Sasy: "Sassy", Xxl: "XXL",
};
const fixTypos = (s) =>
  s.replace(new RegExp(`\\b(${Object.keys(TYPOS).join("|")})\\b`, "g"), (w) => TYPOS[w]);

// Store category → site collection id
const COLLECTION_OF = {
  Face: "face", Lips: "lips", Eyes: "eyes", Eyebrow: "brows",
  "Makeup Brushes": "brushes", "Face care": "skincare", Boxes: "boxes",
};
// Store sub-category → clean product type
const TYPE_NAME = {
  powder: "Powder", "كوركتر": "Corrector", Blusher: "Blush", "BB Cream": "BB cream",
  "Setting Spray": "Setting spray", "Lip gloss": "Lip gloss", "Lip balm": "Lip balm",
  "Lip Liners": "Lip liner", "Eye shadow": "Eyeshadow", "Eyebrow wax": "Brow wax",
  "Eyebrow pencils": "Brow pencil", "Eyebrow gel": "Brow gel", Sunscreen: "Sunscreen",
};

// ---------- Helpers ----------
const slug = (t) =>
  t.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const CODE_RE = /\bn\s*p\s*(\d+)(?:\s*\.\s*([a-z]?\d+))?\b/i;

// "Neverti Matte Couture Liquid Lipstick Coral Silk NP804.105"
//  → { words: ["Matte","Couture",...,"Silk"], line: "804", suffix: "105" }
function parseName(name) {
  const m = name.match(CODE_RE);
  const clean = fixTypos(name.replace(CODE_RE, "").replace(/^\s*Neverti\s+/i, "").replace(/\s+/g, " ").trim());
  const line = m ? CODE_ALIAS[m[1]] || m[1] : null;
  return { words: clean.split(" "), line, suffix: m?.[2] || null, code: m ? `NP${m[1]}${m[2] ? "." + m[2] : ""}` : null };
}

// Word-by-word common start of several names
function commonPrefix(lists) {
  const out = [];
  for (let i = 0; ; i++) {
    const w = lists[0][i];
    if (!w || !lists.every((l) => l[i]?.toLowerCase() === w.toLowerCase())) return out;
    out.push(w);
  }
}

const decode = (s) =>
  s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
   .replace(/&#39;|&rsquo;/g, "’").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

// Description → { intro, features[] }
function parseDescription(text, productName) {
  let d = decode(text || "");
  // Drop the "Product name :" the store puts at the start
  d = d.replace(/^[^:]{0,140}?\s:\s/, "");
  const [intro, rest] = d.split(/Key Features\s*:/i);
  const features = (rest || "")
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim().replace(/\.$/, ""))
    .filter((s) => s.length > 3)
    .slice(0, 8);
  return { intro: (intro || "").trim(), features };
}

function finishOf(name, type) {
  const n = name.toLowerCase();
  if (/gloss|shine|shiny|glow/.test(n)) return "gloss";
  if (/tint|balm|cocktail|oil/.test(n)) return "tint";
  if (/matt|velvet/.test(n)) return "matte";
  return type === "Lip gloss" ? "gloss" : "matte";
}

// Virtual try-on material for each product (TRYON_REALISM_PROMPT.md section 6).
// The material says how the product looks on skin (matte, gloss, oil, cream…).
// null = no try-on: primer, setting spray, sunscreen, brushes, kits, palettes,
// eyeshadow (Neverti's try-on has no eyeshadow).
const MATERIALS = [
  [/palette|kit|primer|spray|sunscreen|eyeshadow|brush/i, null],
  [/matte couture/i, "matte-liquid-lipstick"],          // A1
  [/matt idole|matt mallow/i, "matte-lipstick"],        // A1 (bullet)
  [/let lip rejoice|limitless kiss/i, "satin-lipstick"],// A2
  [/kiss adore shiny/i, "shine-lipstick"],              // A2, shinier
  [/soft tint/i, "lip-tint"],                           // A3
  [/3d plumping/i, "plumping-gloss"],                   // A4
  [/be allure/i, "shimmer-gloss"],                      // A5
  [/lip cocktail/i, "lip-oil"],                         // A6
  [/creamy lip balm/i, "tinted-balm"],                  // A7 (tinted)
  [/waterproof liner|liptrace/i, "lip-liner"],          // A8
  [/soft focus|natural matte flawless/i, "foundation-soft-matte"], // B1
  [/natural glow/i, "foundation-glow"],                 // B2
  [/bb/i, "bb-cream"],                                  // B3
  [/serum concealer|cover concealer/i, "concealer-serum"], // B4
  [/concealer pen/i, "concealer-stick"],                // B5
  [/corrector/i, "color-corrector"],                    // B6
  [/loose powder/i, "powder-loose"],                    // B7
  [/powder/i, "powder-pressed"],                        // B7
  [/lush blush/i, "cream-blush"],                       // C1
  [/liquid blush/i, "liquid-blush"],                    // C2
  [/waterproof blush/i, "powder-blush"],                // C3
  [/contour/i, "contour"],                              // C4
  [/highlighter/i, "highlighter"],                      // C5
  [/eye define liner/i, "kohl-liner"],                  // D1
  [/highest shine/i, "liquid-liner"],                   // D2
  [/dipliner/i, "matte-liquid-liner"],                  // D3
  [/gel eyeliner/i, "gel-liner"],                       // D4
  [/brow up mascara/i, "brow-mascara"],                 // E2
  [/mascara/i, "mascara"],                              // D5
  [/browtastic/i, "brow-pomade"],                       // E1
  [/styler liner/i, "brow-pen"],                        // E3
  [/shaping wax/i, "brow-wax"],                         // E4
];
const materialOf = (name) => (MATERIALS.find(([re]) => re.test(name)) || [null, null])[1];

// Try-on tab for each material
const GROUP_OF = (material) =>
  !material ? null
  : /lip|gloss|balm/.test(material) ? "lips"
  : /blush|contour|highlighter/.test(material) ? "cheeks"
  : /foundation|bb-|concealer|corrector|powder/.test(material) ? "face"
  : /^brow/.test(material) ? "brows"
  : "eyes";

function brushType(name) {
  return /eye|brow|liner|smudge|shader|crease|lash|blending/i.test(name) ? "Eye & brow brushes" : "Face brushes";
}

// ---------- 1) Group products into lines ----------
const products = Object.values(raw.products);
const groups = new Map();
for (const p of products) {
  const parsed = parseName(p.name);
  const key = !parsed.line || NO_GROUP.has(parsed.line) ? `solo-${p.id}` : parsed.line;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push({ p, ...parsed });
}

const lines = [];
for (const [key, items] of groups) {
  const first = items[0];
  const override = LINE_OVERRIDES[first.line];

  // Line name: override, or the words all shades share
  let lineWords;
  if (override) lineWords = override.name.split(" ");
  else if (items.length > 1) lineWords = commonPrefix(items.map((i) => i.words));
  else lineWords = first.words;
  if (lineWords.length < 2) lineWords = first.words; // safety net
  const lineName = lineWords.join(" ");
  const lineSet = new Set([...lineWords, ...(override?.strip || [])].map((w) => w.toLowerCase()));

  // Categories: the store's top category → collection, sub-category → type
  const cats = items.flatMap((i) => i.p.inCategories);
  const top = cats.find((c) => !c.parent && COLLECTION_OF[c.name]);
  const sub = cats.find((c) => c.parent && COLLECTION_OF[c.parent]);
  const collection = COLLECTION_OF[sub?.parent || top?.name] || "face";
  let type = sub ? TYPE_NAME[sub.name] || sub.name : null;
  if (sub?.parent === "Eyebrow" && sub.name === "Mascara") type = "Brow mascara";
  if (first.line === "804") type = "Lipstick"; // Matte Couture is a liquid lipstick (store files it under gloss)
  if (collection === "brushes") type = brushType(lineName);
  if (collection === "skincare") type = "Sunscreen";
  if (collection === "boxes") type = "Kits";
  if (!type) type = { lips: "Lipstick", face: "Face", eyes: "Eyeshadow", brows: "Brow pencil" }[collection];

  const isDeal = cats.some((c) => c.name === "Daily Deal");

  // Shades (sorted by their store code)
  const shades = items
    .map((i) => {
      let shadeName;
      if (items.length === 1) shadeName = null;
      else if (override) shadeName = i.words.filter((w) => !lineSet.has(w.toLowerCase())).join(" ");
      else shadeName = i.words.slice(lineWords.length).join(" ");
      if (items.length > 1 && !shadeName) shadeName = `No. ${i.suffix || "1"}`;
      const p = i.p;
      return {
        id: "",
        name: shadeName,
        code: i.code,
        price: p.price,
        oldPrice: p.regular_price > p.price ? p.regular_price : null,
        imageUrl: p.image?.url || p.original_image,
        storeUrl: p.url,
        inStock: p.is_available && !p.is_out_of_stock,
        storeId: p.id,
        sort: i.suffix || "",
      };
    })
    .sort((a, b) => a.sort.localeCompare(b.sort, "en", { numeric: true }));

  const lineId = slug(lineName);
  shades.forEach((s) => (s.id = s.name ? `${lineId}-${slug(s.name)}` : lineId));

  // Best seller rank, newest rank, real ratings (from the store's lists)
  const bestRank = Math.min(...items.map((i) => raw.bestRank[i.p.id] || Infinity));
  const newRank = Math.min(...items.map((i) => raw.latestRank[i.p.id] || Infinity));
  const promoNew = items.some((i) => /حديث|new/i.test(i.p.promotion_title || ""));
  const rated = items.map((i) => i.p.rating).filter((r) => r?.count);
  const count = rated.reduce((s, r) => s + r.count, 0);
  const rating = count ? { stars: +(rated.reduce((s, r) => s + r.stars * r.count, 0) / count).toFixed(1), count } : null;

  lines.push({
    id: lineId,
    name: lineName,
    collection,
    type,
    finish: finishOf(lineName, type),
    material: materialOf(lineName),
    tryOn: GROUP_OF(materialOf(lineName)), // the try-on tab: lips | face | cheeks | eyes | brows
    description: parseDescription(first.p.description, first.p.name),
    isNew: promoNew || newRank !== Infinity,
    newRank: newRank === Infinity ? null : newRank,
    bestRank: bestRank === Infinity ? null : bestRank,
    isDeal,
    rating,
    shades,
    _evidence: {
      en: decode(first.p.description || ""),
      ar: arText[first.p.id]?.description || "",
      arName: arText[first.p.id]?.name || "",
      swatchPhoto: null,
    },
  });
}

// ---------- Finish, texture, coverage, sheen, shimmer, material (tools/product-finishes.mjs) ----------
const missingFinish = [];
for (const l of lines) {
  const f = FINISHES[l.id];
  const n = NO_TRYON[l.id];
  if (f) {
    Object.assign(l, {
      finish: f.finish, texture: f.texture, coverage: f.coverage, sheen: f.sheen, shimmer: f.shimmer,
      material: f.material, finishLabel: FINISH_LABEL[f.material] || null,
      finishEvidence: f.evidence, finishConfidence: f.confidence,
    });
    l.tryOn = GROUP_OF(f.material);
  } else if (n) {
    Object.assign(l, {
      finish: n.finish, texture: n.texture, coverage: null, sheen: null, shimmer: null, material: null, finishLabel: null,
      finishEvidence: "No try-on: " + n.reason, finishConfidence: "high",
    });
    l.tryOn = null;
  } else if (l.collection !== "brushes") {
    missingFinish.push(l.id);
  } else {
    Object.assign(l, { finish: null, texture: null, coverage: null, sheen: null, shimmer: null, material: null, finishLabel: null,
      finishEvidence: "No try-on: a tool, not makeup.", finishConfidence: "high" });
    l.tryOn = null;
  }
}
if (missingFinish.length) console.log("NO FINISH ROW FOR:", missingFinish.join(", "));

// Two different products with the same name (e.g. two "Powder Brush"):
// add the store code so each has its own name and id
const nameCount = {};
lines.forEach((l) => (nameCount[l.name] = (nameCount[l.name] || 0) + 1));
for (const l of lines) {
  if (nameCount[l.name] > 1) {
    const code = l.shades[0].code?.split(".")[1] || l.shades[0].code || "";
    l.name = `${l.name} ${code}`.trim();
    l.id = slug(l.name);
    l.shades.forEach((s) => (s.id = s.name ? `${l.id}-${slug(s.name)}` : l.id));
  }
}

// ---------- 2) Download one photo per shade ----------
await mkdir(IMG_DIR, { recursive: true });
const exists = (f) => access(f).then(() => true, () => false);
let downloaded = 0, failed = [];

const skipImages = process.argv.includes("--no-images"); // check grouping first
for (const line of lines) {
  for (const s of line.shades) {
    const file = `${IMG_DIR}/${s.id}.jpg`;
    s.image = file;
    if (skipImages || (await exists(file))) continue;
    // Salla's CDN can resize: 800px is plenty and ~10× lighter than the original
    const path = new URL(s.imageUrl).pathname.replace(/^\//, "");
    const url = `https://cdn.salla.sa/cdn-cgi/image/fit=scale-down,width=800,height=800,format=jpeg/${path}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      await writeFile(file, Buffer.from(await res.arrayBuffer()));
      downloaded++;
      await new Promise((r) => setTimeout(r, 80));
    } catch (err) {
      failed.push(`${s.id} (${err.message})`);
    }
  }
}

// ---------- 2b) Shade colors measured from the photos (tools/sample_shades.mjs) ----------
// Approximate: some photo layouts (boxes, white packaging) give wrong colors.
// The site shows photo swatches; hex is only a starting point for the try-on.
let hexes = {};
try { hexes = JSON.parse(await readFile(".tmp/shade-hex.json", "utf8")); } catch {}

// Checked by eye on the review sheet (tools/review_shades.html):
// clear or shimmer products whose photo has no real color swatch.
Object.assign(hexes, {
  "3d-plumping-intense-lipgloss-gloss-me": "#E3B5B0",  // clear gloss
  "be-allure-up-shine-lipgloss-candy-glow": "#F2C6D2", // shimmer light pink
  "lip-cocktail-grape": "#E8B9A8",                     // yellow oil, sheer on lips
  // Mascaras: the photo shows white packaging; the formula is black
  "lash-me-up-mascara": "#121012",
  "mascara-beauty-boost-length-and-define": "#121012",
  "mascara-beauty-boost-volume-and-lift": "#121012",
  "mascara-big-volume-lashes-manifest": "#121012",
  "mascara-max-length-lashes-manifest": "#121012",
  // Brow Up: the brown is only on the tiny wand; Transparent is clear (not shown in try-on)
  "brow-up-mascara-auburn": "#7A4A34",
  "brow-up-mascara-medium-brown": "#5A3C2C",
  "brow-up-mascara-dark-chocolate": "#3A261E",
  "brow-up-mascara-transparent": "#E9E1D8",  // clear: try-on adds only a little sheen
  "brow-shaping-wax": "#FFFFFF",             // clear: try-on adds only sheen
  "eyebrow-styler-liner-no-002": "#7A5449",
  "eyeshadow-creamy-stick": "#6E4A44",
  // Creamy Dimension Powder: color of each powder pan
  "creamy-dimension-waterproof-powder-porcelain-beige": "#F4D9C5",
  "creamy-dimension-waterproof-powder-fair-pink": "#F5CBB5",
  "creamy-dimension-waterproof-powder-neutral": "#DEB496",
  "creamy-dimension-waterproof-powder-almond-beige": "#ECC2A5",
  "creamy-dimension-waterproof-powder-warm-beige": "#DDB193",
  "creamy-dimension-waterproof-powder-medium-beige": "#E2B18E",
  "creamy-dimension-waterproof-powder-soft-mocha": "#DCA175",
  "creamy-dimension-waterproof-powder-warm-honey": "#D39967",
});
for (const line of lines) {
  for (const s of line.shades) {
    s.hex = hexes[s.id] || null;
    s.hexSource = s.hex ? "swatch" : null; // measured from the product photo's swatch (or fixed by hand)
  }
}

// ---------- 2c) Undertone of every shade (FINAL_UPDATE_PROMPT.md section 3.1) ----------
// CIELAB hue angle h = atan2(b*, a*) of the swatch color.
//   reds and pinks (lips, blush; chroma ≥ 40):  h < 30 cool · 30–45 neutral · > 45 warm
//   nudes and browns (lips, blush; chroma < 40): h < 50 cool · 50–60 neutral · > 60 warm
//   foundation, BB, concealer, corrector:        h < 52 cool · 52–62 neutral · > 62 warm
// The thresholds are starting points. Corrections go in tools/undertone-overrides.json.
let undertoneOverrides = {};
try { undertoneOverrides = JSON.parse(await readFile("tools/undertone-overrides.json", "utf8")); } catch { /* none yet */ }
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
function hexToLab(hex) {
  const n = parseInt(hex.slice(1), 16);
  const R = lin((n >> 16) & 255), G = lin((n >> 8) & 255), B = lin(n & 255);
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, Y = R * 0.2126 + G * 0.7152 + B * 0.0722, Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
const UNDERTONE_RULES = {
  lips: ["lipstick", "gloss", "lipliner"], skin: ["foundation", "concealer", "corrector"], cheeks: ["blush"],
};
const slotGroup = (material) =>
  /lipstick|tint|balm|gloss|oil|lip-liner/.test(material) ? "lips" : /blush/.test(material) ? "cheeks" : /foundation|bb-cream|concealer|corrector/.test(material) ? "skin" : null;
const undertoneRows = [];
for (const line of lines) {
  const group = line.material ? slotGroup(line.material) : null;
  for (const sh of line.shades) {
    sh.undertone = null;
    if (!group || !sh.hex) continue;
    const [L, a, b] = hexToLab(sh.hex);
    const h = (Math.atan2(b, a) * 180) / Math.PI, C = Math.hypot(a, b); // signed angle: magenta-pinks just below 0° stay cool
    let u;
    if (group === "skin") u = h < 52 ? "cool" : h <= 62 ? "neutral" : "warm";
    else if (C >= 40) u = h < 30 ? "cool" : h <= 45 ? "neutral" : "warm";
    else u = h < 50 ? "cool" : h <= 60 ? "neutral" : "warm";
    const forced = undertoneOverrides[sh.id];
    undertoneRows.push({ line, shade: sh, h, C, L, computed: u, forced });
    sh.undertone = forced || u;
  }
}

// ---------- 3) Write js/products-data.js ----------
const clean = lines.map(({ shades, _evidence, ...l }) => ({
  ...l,
  shades: shades.map(({ sort, imageUrl, storeId, ...s }) => s),
}));
clean.sort((a, b) => a.collection.localeCompare(b.collection) || a.name.localeCompare(b.name));

// Evidence for the finish checks (never shipped to the site)
await writeFile(".tmp/line-evidence.json", JSON.stringify(Object.fromEntries(lines.map((l) => [l.id, { name: l.name, type: l.type, material: l.material, ..._evidenceOf(l) }])), null, 1));
function _evidenceOf(l) { return l._evidence; }

const header = `// =========================================================
// NEVERTI — products-data.js   (GENERATED — do not edit by hand)
// Source: neverti.com.sa, fetched ${raw.fetchedAt.slice(0, 10)}
// Rebuild: node tools/fetch_neverti.mjs && node tools/build_products.mjs
// =========================================================
`;
await writeFile("js/products-data.js", `${header}\nexport const LINES = ${JSON.stringify(clean, null, 1)};\n`);

// ---------- Report ----------
const report = clean
  .map((l) => `${l.collection.padEnd(9)} ${l.type.padEnd(18)} ${l.name}  [${l.shades.length}] ${l.shades.map((s) => s.name || "-").join(", ")}`)
  .join("\n");
await writeFile(".tmp/grouping-report.txt", report);

const shadeCount = clean.reduce((n, l) => n + l.shades.length, 0);
console.log(`${clean.length} products, ${shadeCount} shades. Images: ${downloaded} new, ${failed.length} failed.`);
if (failed.length) console.log("Failed:", failed.join(", "));


// ---------- PRODUCT_MATERIAL_MAP.md (for the owner to review) ----------
const row = (cells) => "| " + cells.join(" | ") + " |";
const doc = [];
doc.push("# Product material map", "");
doc.push("Generated by `node tools/build_products.mjs`. Do not edit this file by hand:");
doc.push("- to change a product's finish, texture or material, edit its row in `tools/product-finishes.mjs`;");
doc.push("- to change a shade's undertone, add it to `tools/undertone-overrides.json` (for example `{ \"matte-couture-liquid-lipstick-tango-red\": \"warm\" }`);");
doc.push("- then run `node tools/build_products.mjs` again.", "");
doc.push("Every decision uses three checks: the name and description (English and Arabic), the swatch photo, and a cross-check of both. The try-on reads the material from this data, never from the color.", "");
const review = clean.filter((l) => l.finishConfidence && l.finishConfidence !== "high");
doc.push("## Please review", "");
doc.push(review.length ? "These products are not 100% certain (the name, the text and the photo do not fully agree). Tell me if one is wrong." : "Nothing to review.", "");
review.forEach((l) => doc.push(`- **${l.name}** (${l.finishConfidence}): finish **${l.finish}**, texture ${l.texture}. ${l.finishEvidence}`));
doc.push("", "## 1. Products", "");
doc.push(row(["Product", "Collection · type", "Shades", "Finish", "Texture", "Coverage", "Sheen", "Shimmer", "Material", "Confidence", "Evidence"]));
doc.push(row(Array(11).fill("---")));
for (const l of clean.filter((x) => x.collection !== "brushes")) {
  doc.push(row([l.name, `${l.collection} · ${l.type}`, l.shades.length, l.finish || "—", l.texture || "—", l.coverage || "—", l.sheen || "—", l.shimmer || "—",
    l.material || "no try-on", l.finishConfidence || "—", (l.finishEvidence || "").replace(/\|/g, "/")]));
}
doc.push("", `The ${clean.filter((x) => x.collection === "brushes").length} makeup brushes are tools, so they have no finish and no try-on.`, "");
doc.push("## 2. Undertone of every shade", "");
doc.push("Computed from the swatch color (CIELAB hue angle h). Reds and pinks (chroma ≥ 40): h < 30 cool, 30–45 neutral, > 45 warm. Nudes and browns: h < 50 cool, 50–60 neutral, > 60 warm. Foundation, BB, concealer, corrector: h < 52 cool, 52–62 neutral, > 62 warm.", "");
doc.push(row(["Product", "Shade", "Code", "Color", "Hue h°", "Chroma", "Undertone", "Changed by hand"]));
doc.push(row(Array(8).fill("---")));
for (const u of undertoneRows) {
  doc.push(row([u.line.name, u.shade.name || "—", u.shade.code || "—", u.shade.hex, u.h.toFixed(0), u.C.toFixed(0), u.shade.undertone, u.forced ? "yes" : ""]));
}
await writeFile("PRODUCT_MATERIAL_MAP.md", doc.join("\n") + "\n");
const counts = { cool: 0, neutral: 0, warm: 0 };
undertoneRows.forEach((u) => counts[u.shade.undertone]++);
console.log("Undertones:", counts, "· PRODUCT_MATERIAL_MAP.md written");
