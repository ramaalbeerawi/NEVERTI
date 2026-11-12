// =========================================================
// NEVERTI — account.js
// My account: name, email, saved shade match, order history, sign out.
// Signed-out visitors are sent to the home page with the login window open.
// =========================================================

import { requireUser, getProfile, signOut, isDemo } from "./auth.js";
import { getOrders } from "./cart.js";
import { formatPrice, getShade } from "./products.js";

const root = document.getElementById("account");
const user = await requireUser();

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const dateOf = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

root.innerHTML = `
  <header class="account__head">
    <p class="label">My account</p>
    <h1 class="section-title">Hello, <em>${esc(user.name?.split(" ")[0] || "there")}</em></h1>
  </header>

  <section class="account__card stone-panel" aria-labelledby="profile-title">
    <h2 id="profile-title">Your details</h2>
    <dl class="details-list">
      <div><dt>Name</dt><dd>${esc(user.name) || "—"}</dd></div>
      <div><dt>Email</dt><dd>${esc(user.email)}</dd></div>
    </dl>
    ${isDemo() ? `<p class="notice-box">Demo mode: this account is saved in this browser only.</p>` : ""}
    <button class="btn" type="button" id="signout">Sign out</button>
  </section>

  <section class="account__card stone-panel" id="shade-card" aria-labelledby="shade-title" hidden>
    <h2 id="shade-title">Your shade match</h2>
    <div id="shade-body"></div>
  </section>

  <section class="account__card stone-panel" aria-labelledby="orders-title">
    <h2 id="orders-title">Your orders</h2>
    <div id="orders"><p class="status-line" role="status">Loading your orders…</p></div>
  </section>`;

document.getElementById("signout").addEventListener("click", async () => {
  await signOut();
  location.href = "index.html";
});

// ---------- Saved shade match ----------
getProfile().then((profile) => {
  const match = profile?.shadeMatch;
  if (!match) return;
  const card = document.getElementById("shade-card");
  card.hidden = false;
  const items = (match.picks || [])
    .map((p) => ({ ...p, found: getShade(p.id) }))
    .filter((p) => p.found);
  document.getElementById("shade-body").innerHTML = `
    <p>Skin depth <strong>${esc(match.depthLabel)}</strong>, undertone <strong>${esc(String(match.undertone).replace(/^./, (c) => c.toUpperCase()))}</strong>${match.confidence ? `, confidence ${esc(match.confidence)}` : ""}.</p>
    <ul class="match-picks">${items.map(({ found, kind }) => `
      <li><img src="${found.shade.image}" alt="" width="56" height="56">
        <span><strong>${esc(kind)}</strong><br>${esc(found.line.name)}${found.shade.name ? `, ${esc(found.shade.name)}` : ""}</span></li>`).join("")}
    </ul>
    <a class="btn" href="shade-match.html">Update my shade</a>`;
}).catch(() => {});

// ---------- Orders ----------
getOrders().then((orders) => {
  const box = document.getElementById("orders");
  if (!orders.length) {
    box.innerHTML = `
      <div class="empty"><p>No orders yet.</p><a class="btn" href="index.html#new">Shop new arrivals</a></div>`;
    return;
  }
  box.innerHTML = `<ul class="orders">${orders.map((o) => `
    <li class="order">
      <div class="order__head">
        <p><strong>${esc(o.id)}</strong><br><span class="order__date">${dateOf(o.createdAt)}</span></p>
        <p class="order__status">${esc(o.status)}</p>
        <p class="order__total">${formatPrice(o.subtotal)}</p>
      </div>
      <ul class="order__items">${o.items.map((i) => `
        <li><img src="${esc(i.image)}" alt="" width="48" height="48" loading="lazy">
          <span>${esc(i.name)}${i.shade ? `, ${esc(i.shade)}` : ""}${i.code ? ` (${esc(i.code)})` : ""} × ${i.qty}</span>
          <span>${formatPrice(i.price * i.qty)}</span></li>`).join("")}
      </ul>
    </li>`).join("")}</ul>`;
}).catch(() => {
  document.getElementById("orders").innerHTML = `<p class="notice-box">We couldn't load your orders. Reload the page to try again.</p>`;
});
