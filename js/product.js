// =========================================================
// NEVERTI — product.js
// product.html?id=matte-couture-liquid-lipstick&shade=matte-couture-liquid-lipstick-tango-red
// Photo, name, price, shades, quantity, Add to bag, Try this shade,
// details and "You may also like".
// =========================================================

import { getLine, getCollection, getLinesIn, defaultShade, discountPercent, formatPrice } from "./products.js";
import { tileHTML, ratingHTML, priceHTML, productUrl, tryOnUrl, undertoneTag } from "./product-tile.js";
import { undertoneHint, onSkinProfile, applyFitBadges } from "./skin-profile.js";
import { initImageFallbacks } from "./header.js";

const main = document.getElementById("main");
const params = new URLSearchParams(location.search);
const line = getLine(params.get("id"));

if (!line) {
  document.title = "Product not found | Neverti";
  main.innerHTML = `
    <div class="notice">
      <h1>We couldn't find that product.</h1>
      <p>It may have moved. Browse the collections or search for it.</p>
      <a class="btn btn--primary" href="collection.html?c=lips">Shop lips</a>
    </div>`;
} else {
  render();
}

function render() {
  const collection = getCollection(line.collection);
  let shade = line.shades.find((s) => s.id === params.get("shade")) || defaultShade(line);
  const many = line.shades.length > 1;

  document.title = `${line.name} | Neverti`;

  main.innerHTML = `
    <nav class="crumbs" aria-label="Breadcrumb">
      <a href="collection.html?c=${collection.id}">${collection.name}</a>
      <span aria-hidden="true">/</span>
      <a href="collection.html?c=${collection.id}&amp;type=${encodeURIComponent(line.type)}">${line.type}</a>
    </nav>

    <div class="product__grid">
      <div class="img-slot product-media" data-label="Product photo">
        <img id="product-photo" src="${shade.image}" alt="" width="800" height="800">
      </div>

      <div class="product__info">
        <div>
          <p class="label">${line.type}${line.finishLabel ? ` · ${line.finishLabel}` : ""}</p>
          <h1>${line.name}</h1>
        </div>
        ${ratingHTML(line.rating)}
        ${factsHTML(line)}
        <div id="price"></div>
        ${line.description.intro ? `<p class="product__intro">${line.description.intro}</p>` : ""}

        ${many ? `
        <div class="shades">
          <p class="shades__label" id="shade-label"></p>
          <div class="shades__list" role="group" aria-labelledby="shade-label">
            ${line.shades.map((s) => `
              <button class="shade-btn ${s.inStock ? "" : "is-soldout"}" type="button" data-shade="${s.id}"
                aria-label="${s.name}${s.undertone ? `, ${s.undertone} undertone` : ""}${s.inStock ? "" : " (sold out)"}" title="${s.name}${s.undertone ? ` · ${s.undertone}` : ""}">
                <img src="${s.image}" alt="" loading="lazy" width="48" height="48">
              </button>`).join("")}
          </div>
        </div>` : ""}

        <div class="buy">
          <div class="qty" role="group" aria-label="Quantity">
            <button type="button" data-qty="-1" aria-label="Decrease quantity">−</button>
            <input id="qty" type="number" inputmode="numeric" min="1" max="10" value="1" aria-label="Quantity">
            <button type="button" data-qty="1" aria-label="Increase quantity">+</button>
          </div>
          <button class="btn btn--primary" id="add" type="button" data-qty-from="qty">Add to bag</button>
        </div>
        ${line.tryOn ? `<a class="btn" id="try" href="#">Try this shade</a>` : ""}

        ${line.description.features.length ? `
        <div class="details">
          <h2>Details</h2>
          <ul>${line.description.features.map((f) => `<li>${f}</li>`).join("")}</ul>
        </div>` : ""}
      </div>
    </div>

    <section class="related" aria-labelledby="related-title">
      <h2 id="related-title">You may also <em>like</em></h2>
      <div class="product-grid" id="related"></div>
    </section>`;

  const photo = document.getElementById("product-photo");
  const priceBox = document.getElementById("price");
  const addBtn = document.getElementById("add");
  const qty = document.getElementById("qty");

  // ---------- Everything that changes with the chosen shade ----------
  function showShade(next, { updateUrl = true } = {}) {
    shade = next;
    photo.src = shade.image;
    photo.alt = shade.name ? `${line.name} in ${shade.name}` : line.name;

    const off = discountPercent(shade);
    priceBox.innerHTML = priceHTML(shade) + (off ? `<p class="product__save">You save ${formatPrice(shade.oldPrice - shade.price)} (${off}%)</p>` : "");

    if (many) {
      const hint = undertoneHint(shade.undertone);
      document.getElementById("shade-label").innerHTML =
        `Shade: <strong>${shade.name}</strong> ${undertoneTag(shade.undertone)}${shade.inStock ? "" : " — sold out"}` +
        (hint ? ` <span class="hint hint--${hint.kind}">${hint.text}</span>` : "");
      main.querySelectorAll("[data-shade]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.shade === shade.id)));
    }

    addBtn.dataset.addToBag = shade.id; // header.js handles the click
    addBtn.disabled = !shade.inStock;
    addBtn.textContent = shade.inStock ? "Add to bag" : "Sold out";

    const tryBtn = document.getElementById("try");
    if (tryBtn) tryBtn.href = tryOnUrl(line, shade);

    if (updateUrl) history.replaceState(null, "", productUrl(line, shade));
  }

  main.querySelectorAll("[data-shade]").forEach((btn) =>
    btn.addEventListener("click", () => showShade(line.shades.find((s) => s.id === btn.dataset.shade)))
  );

  // ---------- Quantity (1–10) ----------
  const clampQty = (n) => Math.min(10, Math.max(1, Number.isFinite(n) ? n : 1));
  main.querySelectorAll("[data-qty]").forEach((btn) =>
    btn.addEventListener("click", () => (qty.value = clampQty(Number(qty.value) + Number(btn.dataset.qty))))
  );
  qty.addEventListener("change", () => (qty.value = clampQty(parseInt(qty.value, 10))));

  // ---------- You may also like: same collection, same type first ----------
  const related = getLinesIn(line.collection)
    .filter((l) => l.id !== line.id)
    .sort((a, b) => Number(b.type === line.type) - Number(a.type === line.type) || (a.bestRank ?? 999) - (b.bestRank ?? 999))
    .slice(0, 4);
  document.getElementById("related").innerHTML = related.map((l) => tileHTML(l)).join("");

  showShade(shade, { updateUrl: false });
  onSkinProfile(() => showShade(shade, { updateUrl: false })); // the hint appears when her skin profile loads
  initImageFallbacks(main);
  applyFitBadges(main);
}

// "Matte · Liquid · Full coverage": what the product really is
function factsHTML(line) {
  if (!line.finish) return "";
  const cap = (t) => t[0].toUpperCase() + t.slice(1);
  const bits = [line.finishLabel, line.texture && cap(line.texture), line.coverage && `${cap(line.coverage)} coverage`,
    line.sheen && line.sheen !== "none" && `${cap(line.sheen)} sheen`, line.shimmer && line.shimmer !== "none" && `${cap(line.shimmer)} shimmer`].filter(Boolean);
  return `<p class="facts">${bits.join(" · ")}</p>`;
}
