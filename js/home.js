// =========================================================
// NEVERTI — home.js
// Fills the home page with real data:
//   the sliding collection panels, new arrivals (two moving rows), best sellers.
// =========================================================

import { MAIN_COLLECTIONS, newArrivals, bestSellers } from "./products.js";
import { tileHTML } from "./product-tile.js";
import { initImageFallbacks } from "./header.js";
import { applyFitBadges } from "./skin-profile.js";

// ---------- Sliding panels: the four collections, Lips open by default ----------
const PANEL_FOCUS = { lips: "46% 50%", face: "48% 50%", eyes: "22% 50%", brows: "24% 50%" };
document.getElementById("panels").innerHTML = MAIN_COLLECTIONS
  .map((c) => `
    <a class="panel" href="collection.html?c=${c.id}">
      <span class="img-slot" data-label="${c.name}">
        <img src="${c.image}" alt="" style="object-position: ${PANEL_FOCUS[c.id] || "35% 50%"}" ${c.id === "lips" ? "" : 'loading="lazy"'}>
      </span>
      <span class="panel__text"><span class="panel__name">${c.name}</span><span class="panel__count">${c.count} products →</span></span>
    </a>`)
  .join("");

// ---------- New arrivals: two rows moving in opposite directions ----------
// Each row is written twice; the copy is "inert" (not focusable, hidden
// from screen readers) and only exists so the loop looks endless.
document.querySelectorAll("[data-row]").forEach((row) => {
  const lines = newArrivals(row.dataset.row).slice(0, 10);
  if (!lines.length) {
    row.previousElementSibling?.remove(); // the "Lips"/"Face" label
    row.remove();
    return;
  }
  const real = lines.map((l) => tileHTML(l)).join("");
  const copy = lines.map((l) => tileHTML(l, { inert: true })).join("");
  row.innerHTML = `<div class="marquee__track">${real}${copy}</div>`;
});

// ---------- Best sellers: 8 products, store order, real ratings ----------
document.getElementById("best-grid").innerHTML = bestSellers(8)
  .map((l) => tileHTML(l, { showRating: true }))
  .join("");

initImageFallbacks(document.querySelector("main"));
applyFitBadges();
