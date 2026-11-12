// =========================================================
// NEVERTI — collection.js
// collection.html?c=lips&type=Lipstick&sort=price-asc
// Banner + filter chips + sort + product grid. The URL follows the filters,
// so a filtered page can be shared or reloaded.
// =========================================================

import { getCollection, getLinesIn, lowestPrice, MAIN_COLLECTIONS } from "./products.js";
import { tileHTML } from "./product-tile.js";
import { initImageFallbacks } from "./header.js";
import { onSkinProfile, myUndertone, applyFitBadges } from "./skin-profile.js";

const root = document.getElementById("collection");
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const collection = getCollection(params.get("c") || "lips");

const SORTS = {
  featured: { label: "Featured", fn: (a, b) => (a.bestRank ?? 999) - (b.bestRank ?? 999) || Number(b.isNew) - Number(a.isNew) },
  "price-asc": { label: "Price: low to high", fn: (a, b) => lowestPrice(a) - lowestPrice(b) },
  "price-desc": { label: "Price: high to low", fn: (a, b) => lowestPrice(b) - lowestPrice(a) },
  new: { label: "New", fn: (a, b) => (a.newRank ?? 999) - (b.newRank ?? 999) || Number(b.isNew) - Number(a.isNew) },
};

// ---------- Unknown collection ----------
if (!collection) {
  document.title = "Collection not found | Neverti";
  root.innerHTML = `
    <div class="notice">
      <h1>We couldn't find that collection.</h1>
      <p>Choose one of ours instead.</p>
      <div class="chips">
        ${MAIN_COLLECTIONS.map((c) => `<a class="btn" href="collection.html?c=${c.id}">${c.name}</a>`).join("")}
      </div>
    </div>`;
} else {
  render();
}

function render() {
  // Finish chips are shown in this order when a collection has them
  const FINISH_ORDER = ["Matte", "Cream", "Tint", "Gloss", "Shimmer gloss", "Oil", "Balm", "Liner",
    "Soft-matte", "Radiant", "Dewy", "Full coverage", "Corrector", "Pressed", "Loose",
    "Powder", "Powder-cream", "Liquid", "Glowy", "Contour", "Pearl",
    "Kohl", "Glossy liquid", "Matte liquid", "Gel", "Mascara", "Pomade", "Tinted", "Pen", "Wax"];
  const UNDERTONES = ["cool", "neutral", "warm"];
  const hasUndertone = (line, u) => line.shades.some((shade) => shade.undertone === u);
  
  const all = getLinesIn(collection.id);
  // Types: the collection's list, or (for Daily deals) whatever types its products have
  const types = collection.types.length ? collection.types : [...new Set(all.map((l) => l.type))];
  let type = types.includes(params.get("type")) ? params.get("type") : "All";
  let finish = params.get("finish") || "All";
  let undertone = params.get("undertone") || "All"; // cool | neutral | warm | mine
  let sort = SORTS[params.get("sort")] ? params.get("sort") : "featured";
  const anyUndertone = all.some((l) => l.shades.some((sh) => sh.undertone));

  document.title = `${collection.name} | Neverti`;

  const banner = collection.image
    ? `<div class="banner">
         <span class="img-slot" data-label="Collection photo">
           <img src="${collection.image}" alt="" style="object-position: 35% 50%">
         </span>
         <div class="banner__text">
           <p class="label">Collection ${collection.number}</p>
           <h1>${collection.name}</h1>
         </div>
       </div>`
    : `<div class="banner banner--plain">
         <div class="banner__text">
           ${collection.number ? `<p class="label">Collection ${collection.number}</p>` : ""}
           <h1>${collection.name}</h1>
         </div>
       </div>`;

  root.innerHTML = `
    ${banner}
    <div class="filters">
      <div class="filters__rows">
        <div class="chips" id="type-chips" role="group" aria-label="Filter by type"></div>
        <div class="chips" id="finish-chips" role="group" aria-label="Filter by finish"></div>
        <div class="chips" id="undertone-chips" role="group" aria-label="Filter by undertone"></div>
      </div>
      <label class="sort">Sort by
        <select id="sort">
          ${Object.entries(SORTS).map(([key, s]) => `<option value="${key}" ${key === sort ? "selected" : ""}>${s.label}</option>`).join("")}
        </select>
      </label>
    </div>
    <p class="result-count" id="count" role="status"></p>
    <div class="product-grid" id="grid"></div>`;

  const grid = document.getElementById("grid");
  const count = document.getElementById("count");
  const chip = (attr, value, label, on) => `<button class="chip" type="button" data-${attr}="${value}" aria-pressed="${on}">${label}</button>`;

  const resolvedUndertone = () => (undertone === "mine" ? myUndertone() : undertone);
  const byType = () => all.filter((l) => type === "All" || l.type === type);

  function drawChips() {
    $("type-chips").innerHTML = ["All", ...types].map((t) => chip("type", t, t === "All" ? "All types" : t, t === type)).join("");

    // Finishes that exist in the chosen type
    const finishes = [...new Set(byType().map((l) => l.finishLabel).filter(Boolean))]
      .sort((a, b) => FINISH_ORDER.indexOf(a) - FINISH_ORDER.indexOf(b));
    if (finish !== "All" && !finishes.includes(finish)) finish = "All";
    $("finish-chips").innerHTML = finishes.length > 1
      ? ["All", ...finishes].map((f) => chip("finish", f, f === "All" ? "All finishes" : f, f === finish)).join("")
      : "";

    const mine = myUndertone();
    if (undertone === "mine" && !mine) undertone = "All";
    $("undertone-chips").innerHTML = anyUndertone
      ? ["All", ...UNDERTONES, ...(mine ? ["mine"] : [])]
          .map((u) => chip("undertone", u, u === "All" ? "Any undertone" : u === "mine" ? `My undertone (${mine})` : `${u[0].toUpperCase() + u.slice(1)} undertone`, u === undertone))
          .join("")
      : "";
  }

  function update() {
    drawChips();
    const u = resolvedUndertone();
    const list = byType()
      .filter((l) => finish === "All" || l.finishLabel === finish)
      .filter((l) => !u || u === "All" || hasUndertone(l, u))
      .sort(SORTS[sort].fn);
    count.textContent = `${list.length} ${list.length === 1 ? "product" : "products"}`;
    grid.innerHTML = list.length
      ? list.map((l) => tileHTML(l)).join("")
      : `<div class="notice"><h2>Nothing matches these filters.</h2><p>Try another finish or undertone, or clear the filters.</p><button class="btn" type="button" data-clear>Clear filters</button></div>`;
    initImageFallbacks(grid);
    applyFitBadges(grid);

    // Keep the URL in step with the filters
    const url = new URL(location.href);
    url.searchParams.set("c", collection.id);
    const set = (key, value, empty) => (value === empty ? url.searchParams.delete(key) : url.searchParams.set(key, value));
    set("type", type, "All"); set("finish", finish, "All"); set("undertone", undertone, "All"); set("sort", sort, "featured");
    history.replaceState(null, "", url);
  }

  root.addEventListener("click", (e) => {
    const t = e.target.closest("[data-type], [data-finish], [data-undertone], [data-clear]");
    if (!t) return;
    if (t.hasAttribute("data-clear")) { type = finish = undertone = "All"; }
    else if (t.dataset.type !== undefined) { type = t.dataset.type; }
    else if (t.dataset.finish !== undefined) { finish = t.dataset.finish; }
    else if (t.dataset.undertone !== undefined) { undertone = t.dataset.undertone; }
    update();
  });
  document.getElementById("sort").addEventListener("change", (e) => {
    sort = e.target.value;
    update();
  });
  onSkinProfile(() => update()); // "My undertone" appears (or its badges refresh) when the profile loads

  initImageFallbacks(root);
  update();
}
