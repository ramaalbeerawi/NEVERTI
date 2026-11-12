// =========================================================
// NEVERTI — products.js
// Collections + helpers. The product data itself is generated from the
// real store into js/products-data.js (see tools/build_products.mjs).
//
// A "line" = one product (e.g. Matte Couture Liquid Lipstick)
// with one or more "shades" (each with its own photo, price and stock).
// =========================================================

import { LINES } from "./products-data.js";

export { LINES };

// ---------- Shade colors corrected by hand (Materials lab) ----------
// Saved in this browser: { shadeId: "#RRGGBB" }. Applied to the catalog on load.
const OVERRIDES_KEY = "neverti.hexOverrides";
export function hexOverrides() {
  try { return JSON.parse(localStorage.getItem(OVERRIDES_KEY)) || {}; } catch { return {}; }
}
export function saveHexOverride(shadeId, hex) {
  try { localStorage.setItem(OVERRIDES_KEY, JSON.stringify({ ...hexOverrides(), [shadeId]: hex })); } catch { /* storage blocked */ }
}
export function clearHexOverride(shadeId) {
  const all = hexOverrides();
  delete all[shadeId];
  try { localStorage.setItem(OVERRIDES_KEY, JSON.stringify(all)); } catch { /* storage blocked */ }
}
{
  const overrides = hexOverrides();
  for (const line of LINES) for (const s of line.shades) {
    if (overrides[s.id]) { s.hex = overrides[s.id]; s.hexSource = "manual"; }
  }
}

// ---------- Site images (one place for every path; see build brief section 11) ----------
// bg-stone.jpg and lipstick-texture.jpg are used from CSS (css/base.css).
export const IMAGES = {
  background: "assets/images/bg-stone.jpg",
  lipstickTexture: "assets/images/lipstick-texture.jpg",
  model: "assets/images/model.png",                 // bare-face model for the try-on
  lipstickCutout: "assets/images/lipstick-red.png", // optional, never slide it around
};

// ---------- Collections ----------
// The first four have photos and lead the navbar. Types are listed in the
// order we want them shown; only types that really have products appear.
const COLLECTION_LIST = [
  {
    id: "lips", number: "01", name: "Lips", image: "assets/images/collection-lips.jpg",
    typeOrder: ["Lipstick", "Lip gloss", "Lip balm", "Lip liner"],
  },
  {
    id: "face", number: "02", name: "Face",
    image: "assets/images/collection-face-TEMP.jpg", // temporary photo, will be replaced
    typeOrder: ["Foundation", "BB cream", "Concealer", "Corrector", "Powder", "Blush", "Contour", "Highlighter", "Primer", "Setting spray"],
  },
  {
    id: "eyes", number: "03", name: "Eyes", image: "assets/images/collection-eyes.jpg",
    typeOrder: ["Mascara", "Eyeliner", "Eyeshadow"],
  },
  {
    id: "brows", number: "04", name: "Brows", image: "assets/images/collection-brows.jpg",
    typeOrder: ["Brow pencil", "Brow gel", "Brow mascara", "Brow wax"],
  },
  { id: "brushes", number: "05", name: "Makeup brushes", image: null, typeOrder: ["Face brushes", "Eye & brow brushes"] },
  { id: "skincare", number: "06", name: "Skincare", image: null, typeOrder: ["Sunscreen"] },
  { id: "boxes", number: "07", name: "Boxes", image: null, typeOrder: ["Kits"] },
];

export const COLLECTIONS = COLLECTION_LIST.map(({ typeOrder, ...c }) => {
  const lines = LINES.filter((l) => l.collection === c.id);
  return {
    ...c,
    count: lines.length,
    types: typeOrder.filter((t) => lines.some((l) => l.type === t)),
  };
});

// The four photo collections (navbar mega menu, home cards)
export const MAIN_COLLECTIONS = COLLECTIONS.slice(0, 4);
// The rest (text links)
export const MORE_COLLECTIONS = COLLECTIONS.slice(4);

// A virtual collection: the store's "Daily Deal" products
export const DEALS = { id: "deals", number: "", name: "Daily deals", image: null, types: [] };

// ---------- Lookups ----------
export const getCollection = (id) =>
  id === "deals" ? { ...DEALS, count: LINES.filter((l) => l.isDeal).length } : COLLECTIONS.find((c) => c.id === id) || null;

export const getLine = (id) => LINES.find((l) => l.id === id) || null;

// Find a line from a shade id (useful for the bag later)
export function getShade(shadeId) {
  for (const line of LINES) {
    const shade = line.shades.find((s) => s.id === shadeId);
    if (shade) return { line, shade };
  }
  return null;
}

export const getLinesIn = (collectionId) =>
  collectionId === "deals" ? LINES.filter((l) => l.isDeal) : LINES.filter((l) => l.collection === collectionId);

// The shade a card shows first: the first one in stock
export const defaultShade = (line) => line.shades.find((s) => s.inStock) || line.shades[0];

// Newest first (store order), only products marked new
export function newArrivals(collectionId) {
  return LINES.filter((l) => l.isNew && (!collectionId || l.collection === collectionId))
    .sort((a, b) => (a.newRank ?? 999) - (b.newRank ?? 999) || a.name.localeCompare(b.name));
}

// The store's own best-seller order
export function bestSellers(count = 8) {
  return LINES.filter((l) => l.bestRank).sort((a, b) => a.bestRank - b.bestRank).slice(0, count);
}

// ---------- Prices ----------
// 26.45 -> "SAR 26.45"
export const formatPrice = (amount) => `SAR ${Number(amount).toFixed(2)}`;

export const lowestPrice = (line) => Math.min(...line.shades.map((s) => s.price));
export const hasPriceRange = (line) => new Set(line.shades.map((s) => s.price)).size > 1;

// 34.50 → 26.45 = 23
export const discountPercent = (shade) =>
  shade.oldPrice ? Math.round((1 - shade.price / shade.oldPrice) * 100) : 0;
