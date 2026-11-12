// =========================================================
// NEVERTI — account-ui.js
// Connects the shared header parts to the real logic:
//   · login modal (sign in, create account, Google, forgot password)
//   · header buttons that change when signed in (My account / Sign out)
//   · the bag drawer and the gold count
//   · login-gated "Add to bag" (the item is added automatically after sign-in)
// header.js calls initAccountUI() once the shared HTML is on the page.
// =========================================================

import {
  onAuth, getUser, signUp, signIn, signInWithGoogle, resetPassword, signOut,
  friendlyError, isDemo, demoReason,
} from "./auth.js";
import * as cart from "./cart.js";
import { getShade, formatPrice } from "./products.js";
import { productUrl } from "./product-tile.js";

let ui = null; // { openDialog, closeDialog, openLogin } handed over by header.js
const $ = (id) => document.getElementById(id);

// ---------- Items waiting for sign-in ----------
const PENDING = "neverti.pending";
const savePending = (entries) => { try { sessionStorage.setItem(PENDING, JSON.stringify(entries)); } catch { /* ignore */ } };
const takePending = () => {
  try {
    const list = JSON.parse(sessionStorage.getItem(PENDING) || "[]");
    sessionStorage.removeItem(PENDING);
    return list;
  } catch { return []; }
};

async function addAll(entries) {
  for (const { id, qty = 1 } of entries) await cart.add(id, qty);
}

/**
 * Add products to the bag. Signed in: add and show the bag.
 * Signed out: remember them, open the login window, and add them right
 * after a successful sign-in.   entries = [{ id: shadeId, qty }]
 */
export async function requestAdd(entries, label) {
  if (getUser()) {
    await addAll(entries);
    ui.openDialog("bag-dialog");
    return true;
  }
  savePending(entries);
  ui.openLogin(`Sign in to add ${label} to your bag.`);
  return false;
}

export const labelFor = (shadeId) => {
  const found = getShade(shadeId);
  if (!found) return "this";
  return found.shade.name ? `${found.line.name} in ${found.shade.name}` : found.line.name;
};

// ---------- Header buttons for signed-in / signed-out ----------
function renderAuthState(user) {
  document.querySelectorAll("[data-auth-in]").forEach((el) => (el.hidden = !user));
  document.querySelectorAll("[data-auth-out]").forEach((el) => (el.hidden = Boolean(user)));
  document.querySelectorAll("[data-user-name]").forEach((el) => (el.textContent = user?.name?.split(" ")[0] || "My account"));
}

// ---------- Login modal ----------
function initLoginForms() {
  const message = $("login-message");
  const note = $("login-note");
  const say = (text, bad = false) => {
    message.textContent = text;
    message.classList.toggle("is-error", bad);
  };

  // Demo mode: tell the visitor honestly where accounts live
  onAuth(() => {
    if (!isDemo()) return (note.hidden = true);
    note.hidden = false;
    note.textContent = demoReason() === "error"
      ? "Demo mode: Firebase could not start, so accounts are saved in this browser only."
      : "Demo mode: accounts are saved in this browser only.";
  });

  async function afterSignIn() {
    say("");
    ui.closeDialog($("login-dialog"));
    const pending = takePending();
    if (pending.length) {
      await addAll(pending);
      ui.openDialog("bag-dialog");
      return;
    }
    // Sent here from checkout / account? Take them back.
    let back = null;
    try { back = sessionStorage.getItem("neverti.returnTo"); sessionStorage.removeItem("neverti.returnTo"); } catch { /* ignore */ }
    if (back) location.href = back;
  }

  async function run(form, task) {
    const submit = form.querySelector("[type=submit]");
    submit.disabled = true;
    say("Please wait…");
    try {
      await task();
      await afterSignIn();
    } catch (err) {
      say(friendlyError(err), true);
    } finally {
      submit.disabled = false;
    }
  }

  document.querySelector('[data-auth-form="signin"]').addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    if (!f.email.value.trim() || !f.password.value) return say("Enter your email and password.", true);
    run(f, () => signIn({ email: f.email.value, password: f.password.value }));
  });

  document.querySelector('[data-auth-form="signup"]').addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    if (!f.name.value.trim()) return say("Enter your name.", true);
    if (f.password.value !== f.confirm.value) return say("The two passwords don't match.", true);
    run(f, () => signUp({ name: f.name.value, email: f.email.value, password: f.password.value }));
  });

  const googleBtn = document.querySelector("[data-google]");
  googleBtn.addEventListener("click", async () => {
    googleBtn.disabled = true;
    say("Opening Google…");
    try {
      await signInWithGoogle();
      await afterSignIn();
    } catch (err) {
      say(friendlyError(err), true);
    } finally {
      googleBtn.disabled = false;
    }
  });

  document.querySelector("[data-forgot]").addEventListener("click", async () => {
    const email = document.querySelector('[data-auth-form="signin"]').email.value.trim();
    if (!email) return say("Enter your email above, then press Forgot password again.", true);
    say("Sending…");
    try {
      await resetPassword(email);
      say(`We sent a reset link to ${email}. Check your inbox.`);
    } catch (err) {
      say(friendlyError(err), true);
    }
  });

  // Clear the old reason and message when the window closes
  $("login-dialog").addEventListener("close", () => {
    say("");
    $("login-reason").hidden = true;
  });
}

// ---------- Bag drawer ----------
function renderBag(state) {
  const user = getUser();
  document.querySelectorAll("[data-bag-count]").forEach((el) => (el.textContent = state.count));
  const bagBtn = document.querySelector(".bag-btn");
  if (bagBtn) bagBtn.setAttribute("aria-label", `Bag, ${state.count} ${state.count === 1 ? "item" : "items"}`);

  const body = $("bag-items");
  if (!user) {
    body.innerHTML = `
      <div class="empty">
        <p>Sign in to see your bag.</p>
        <button class="btn btn--primary" type="button" data-open="login-dialog">Sign in</button>
      </div>`;
  } else if (!state.items.length) {
    body.innerHTML = `
      <div class="empty">
        <p>Your bag is empty.</p>
        <a class="btn" href="index.html#new" data-close>Shop new arrivals</a>
      </div>`;
  } else {
    body.innerHTML = `<ul class="bag-list">${state.items
      .map(({ id, qty, line, shade }) => `
        <li class="bag-item">
          <a class="bag-item__photo" href="${productUrl(line, shade)}" data-close tabindex="-1" aria-hidden="true">
            <img src="${shade.image}" alt="" width="72" height="72" loading="lazy">
          </a>
          <div class="bag-item__info">
            <a class="bag-item__name" href="${productUrl(line, shade)}" data-close>${line.name}</a>
            ${shade.name ? `<p class="bag-item__shade">${shade.name}${shade.code ? ` · ${shade.code}` : ""}</p>` : ""}
            <div class="qty qty--small" role="group" aria-label="Quantity of ${line.name}">
              <button type="button" data-qty="${id}" data-delta="-1" aria-label="Decrease quantity">−</button>
              <span aria-live="polite">${qty}</span>
              <button type="button" data-qty="${id}" data-delta="1" aria-label="Increase quantity">+</button>
            </div>
          </div>
          <div class="bag-item__side">
            <span class="bag-item__price">${formatPrice(shade.price * qty)}</span>
            <button class="link-btn" type="button" data-remove-item="${id}">Remove</button>
          </div>
        </li>`).join("")}</ul>`;
  }

  $("bag-subtotal").textContent = formatPrice(state.subtotal);
  const checkout = document.querySelector(".drawer__foot a.btn--primary");
  const enabled = user && state.items.length > 0;
  checkout.classList.toggle("is-disabled", !enabled);
  checkout.setAttribute("aria-disabled", String(!enabled));
  checkout.tabIndex = enabled ? 0 : -1;
}

function initBag() {
  cart.subscribe(renderBag);

  $("bag-items").addEventListener("click", (e) => {
    const qtyBtn = e.target.closest("[data-qty]");
    if (qtyBtn) {
      const id = qtyBtn.dataset.qty;
      const item = currentState().items.find((i) => i.id === id);
      if (item) cart.setQty(id, item.qty + Number(qtyBtn.dataset.delta));
      return;
    }
    const removeBtn = e.target.closest("[data-remove-item]");
    if (removeBtn) cart.remove(removeBtn.dataset.removeItem);
  });
}

// Latest bag state (the drawer needs it for + / −)
let latest = { items: [], count: 0, subtotal: 0 };
cart.subscribe((s) => { latest = s; });
const currentState = () => latest;
const renderBagNow = () => renderBag(latest);

// ---------- Add to bag buttons anywhere on the site ----------
function initAddButtons() {
  document.addEventListener("click", (e) => {
    const button = e.target.closest("[data-add-to-bag]");
    if (!button || button.disabled) return;
    const id = button.dataset.addToBag;
    const qtyInput = document.getElementById(button.dataset.qtyFrom || "");
    const qty = qtyInput ? Math.max(1, parseInt(qtyInput.value, 10) || 1) : 1;
    requestAdd([{ id, qty }], labelFor(id));
  });
}

// ---------- Start ----------
export function initAccountUI(helpers) {
  ui = helpers;
  initLoginForms();
  initBag();
  initAddButtons();

  onAuth((user) => {
    renderAuthState(user);
    renderBagNow();
  });

  document.addEventListener("click", async (e) => {
    if (!e.target.closest("[data-signout]")) return;
    await signOut();
    if (/(account|checkout)\.html$/.test(location.pathname)) location.href = "index.html";
  });

  // Redirected here from a protected page
  if (new URLSearchParams(location.search).get("login")) {
    onAuth((user) => {
      if (!user) ui.openLogin("Sign in to continue.");
    });
  }
}
