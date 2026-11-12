// =========================================================
// NEVERTI — product-tile.js
// One product card, written once and used on every page.
// =========================================================

import { defaultShade, formatPrice, lowestPrice, hasPriceRange, discountPercent } from "./products.js";

// Link to a product page (optionally with a chosen shade)
export const productUrl = (line, shade) =>
  `product.html?id=${line.id}${shade && line.shades.length > 1 ? `&shade=${shade.id}` : ""}`;

export const tryOnUrl = (line, shade) =>
  `try-on.html?product=${line.id}${shade ? `&shade=${shade.id}` : ""}`;

// "★ 4.9 (24)"
export function ratingHTML(rating) {
  if (!rating) return "";
  return `<p class="rating" aria-label="Rated ${rating.stars} out of 5 by ${rating.count} customers">
    <span aria-hidden="true">★</span> ${rating.stars.toFixed(1)} <span class="rating__count">(${rating.count})</span>
  </p>`;
}

// Price with old price + discount, e.g.  SAR 26.45  SAR 34.50
export function priceHTML(shade, { from = false } = {}) {
  return `<p class="price">
    <span class="price__now">${from ? "From " : ""}${formatPrice(shade.price)}</span>
    ${shade.oldPrice ? `<s class="price__old"><span class="visually-hidden">Was </span>${formatPrice(shade.oldPrice)}</s>` : ""}
  </p>`;
}

/**
 * Product card.
 * options.showRating – show stars (best sellers)
 * options.inert      – a decorative copy (marquee clone): not focusable, hidden from screen readers
 */
export function tileHTML(line, { showRating = false, inert = false } = {}) {
  const shade = defaultShade(line);
  const url = productUrl(line, shade);
  const range = hasPriceRange(line);
  const priceShade = range ? { ...shade, price: lowestPrice(line), oldPrice: null } : shade;
  const off = discountPercent(shade);
  const soldOut = line.shades.every((s) => !s.inStock);
  // "Matte · 12 shades": the real finish of the product, then how many shades
  const count = line.shades.length > 1 ? `${line.shades.length} shades` : "";
  const meta = [line.finishLabel, count].filter(Boolean).join(" · ") || line.type;
  const unders = [...new Set(line.shades.map((s) => s.undertone).filter(Boolean))];

  return `
  <article class="tile"${inert ? ' inert aria-hidden="true"' : ""}>
    <a class="tile__media-link" href="${url}" tabindex="-1" aria-hidden="true">
      <span class="img-slot tile__media" data-label="Product photo">
        <img src="${shade.image}" alt="" loading="lazy" width="800" height="800">
      </span>
      ${off && !range ? `<span class="badge">−${off}%</span>` : line.isNew ? `<span class="badge badge--soft">New</span>` : ""}
    </a>
    <a class="tile__name" href="${url}">${line.name}</a>
    <p class="tile__meta">${meta}</p>
    ${unders.length ? `<p class="tile__fit" data-fit="${unders.join(",")}" hidden></p>` : ""}
    ${showRating ? ratingHTML(line.rating) : ""}
    ${priceHTML(priceShade, { from: range })}
    <button class="btn btn--block tile__add" type="button" data-add-to-bag="${shade.id}" ${soldOut ? "disabled" : ""}>
      ${soldOut ? "Sold out" : "Add to bag"}
    </button>
    ${line.tryOn ? `<a class="tile__try" href="${tryOnUrl(line, shade)}">Try on</a>` : `<span class="tile__try-spacer" aria-hidden="true"></span>`}
  </article>`;
}

// A small outlined "Warm / Cool / Neutral" label for a shade
export const undertoneTag = (u) => (u ? `<span class="tag tag--${u}">${u[0].toUpperCase() + u.slice(1)}</span>` : "");
