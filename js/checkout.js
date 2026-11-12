// =========================================================
// NEVERTI — checkout.js
// Shipping form + order summary. "Place order" saves the order and empties
// the bag. No real payment is taken (this is a portfolio concept).
// Signed-out visitors are sent to the home page with the login window open.
// =========================================================

import { requireUser } from "./auth.js";
import * as cart from "./cart.js";
import { formatPrice } from "./products.js";
import { productUrl } from "./product-tile.js";

const root = document.getElementById("checkout");
const user = await requireUser();

let placed = false; // after an order, don't show "bag is empty" over the confirmation

const summaryItems = (items) => `
  <ul class="bag-list">${items.map(({ qty, line, shade }) => `
    <li class="bag-item">
      <a class="bag-item__photo" href="${productUrl(line, shade)}" tabindex="-1" aria-hidden="true">
        <img src="${shade.image}" alt="" width="72" height="72" loading="lazy">
      </a>
      <div class="bag-item__info">
        <a class="bag-item__name" href="${productUrl(line, shade)}">${line.name}</a>
        ${shade.name ? `<p class="bag-item__shade">${shade.name}${shade.code ? ` · ${shade.code}` : ""}</p>` : ""}
        <p class="bag-item__shade">Qty ${qty}</p>
      </div>
      <div class="bag-item__side"><span class="bag-item__price">${formatPrice(shade.price * qty)}</span></div>
    </li>`).join("")}
  </ul>`;

let formBuilt = false;

function render(state) {
  if (placed) return;

  if (!state.items.length) {
    formBuilt = false;
    root.innerHTML = `
      <div class="notice">
        <h1>Your bag is empty.</h1>
        <p>Add something you love, then come back to check out.</p>
        <a class="btn btn--primary" href="index.html#new">Shop new arrivals</a>
      </div>`;
    return;
  }

  // Build the form once; later changes only refresh the summary
  if (!formBuilt) {
    formBuilt = true;
    root.innerHTML = `
      <h1 class="section-title">Check<em>out</em></h1>
      <div class="checkout">
        <form class="form checkout__form" id="order-form" novalidate>
          <h2>Shipping details</h2>
          <label class="field"><span>Full name</span>
            <input name="fullName" autocomplete="name" value="${user.name || ""}" required></label>
          <label class="field"><span>Phone</span>
            <input name="phone" type="tel" autocomplete="tel" inputmode="tel" required></label>
          <label class="field"><span>City</span>
            <input name="city" autocomplete="address-level2" required></label>
          <label class="field"><span>Address</span>
            <textarea name="address" rows="3" autocomplete="street-address" required></textarea></label>
          <p class="notice-box">Payment is not connected in this demo. Placing an order saves it to your account without charging anything.</p>
          <p class="form__message" id="order-message" role="alert"></p>
          <button class="btn btn--primary btn--block" type="submit" id="place-order">Place order</button>
        </form>

        <aside class="checkout__summary stone-panel" aria-labelledby="summary-title">
          <h2 id="summary-title">Your bag</h2>
          <div id="summary"></div>
          <p class="checkout__total"><span>Total</span><span id="total"></span></p>
          <p class="checkout__shipping">Shipping fees are not added in this demo.</p>
        </aside>
      </div>`;
    document.getElementById("order-form").addEventListener("submit", submit);
  }
  document.getElementById("summary").innerHTML = summaryItems(state.items);
  document.getElementById("total").textContent = formatPrice(state.subtotal);
}

async function submit(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const message = document.getElementById("order-message");
  const button = document.getElementById("place-order");
  const address = Object.fromEntries(
    ["fullName", "phone", "city", "address"].map((k) => [k, form[k].value.trim()])
  );

  const missing = { fullName: "your full name", phone: "your phone number", city: "your city", address: "your address" };
  const first = Object.keys(missing).find((k) => !address[k]);
  if (first) {
    message.textContent = `Enter ${missing[first]}.`;
    form[first].focus();
    return;
  }
  if (!/^[+()\d\s-]{7,}$/.test(address.phone)) {
    message.textContent = "Enter a phone number with digits only, like +966 50 123 4567.";
    form.phone.focus();
    return;
  }

  button.disabled = true;
  message.textContent = "Placing your order…";
  try {
    const items = await new Promise((ok) => cart.subscribe((s) => ok(s.items))); // current bag
    const total = items.reduce((sum, i) => sum + i.shade.price * i.qty, 0);
    placed = true; // the bag empties during the order: keep the confirmation on screen
    let orderId;
    try {
      orderId = await cart.placeOrder(address);
    } catch (err) {
      placed = false;
      throw err;
    }
    root.innerHTML = `
      <div class="notice confirmation">
        <p class="label">Order placed</p>
        <h1 class="section-title">Thank <em>you</em></h1>
        <p>Your order number is <strong class="order-number">${orderId}</strong>. We saved it to your account.</p>
        <p class="notice-box">Payment is not connected in this demo, so nothing was charged.</p>
        <p class="checkout__total checkout__total--final"><span>Order total</span><span>${formatPrice(total)}</span></p>
        <div class="home-intro__actions">
          <a class="btn btn--primary" href="account.html">See my orders</a>
          <a class="btn" href="index.html">Keep shopping</a>
        </div>
      </div>`;
    window.scrollTo({ top: 0 });
  } catch (err) {
    console.error(err);
    message.textContent = "We couldn't place your order. Check your connection and try again.";
    button.disabled = false;
  }
}

cart.subscribe(render);
