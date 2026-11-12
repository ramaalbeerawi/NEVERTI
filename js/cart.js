// =========================================================
// NEVERTI — cart.js
// The bag. Signed-in visitors only. It lives in Firestore (live on every
// device) or, in demo mode, in this browser. Also places orders.
// =========================================================

import { onAuth, getBackend, getUser } from "./auth.js";
import { getShade } from "./products.js";

let raw = [];            // [{ id, qty }] from the backend
let stopWatching = null;
const listeners = new Set();

function state() {
  const items = raw
    .map(({ id, qty }) => {
      const found = getShade(id);
      return found ? { id, qty, line: found.line, shade: found.shade } : null;
    })
    .filter(Boolean);
  return {
    items,
    count: items.reduce((n, i) => n + i.qty, 0),
    subtotal: items.reduce((sum, i) => sum + i.shade.price * i.qty, 0),
  };
}
const emit = () => listeners.forEach((cb) => cb(state()));

// Start / stop watching the bag when someone signs in / out
onAuth(async (user) => {
  stopWatching?.();
  stopWatching = null;
  raw = [];
  if (!user) return emit();
  const backend = await getBackend();
  stopWatching = backend.watchCart(user.uid, (list) => { raw = list; emit(); });
});

// cb runs now and on every change of the bag
export function subscribe(cb) {
  listeners.add(cb);
  cb(state());
  return () => listeners.delete(cb);
}

// ---------- Changes ----------
export async function add(shadeId, qty = 1) {
  const user = getUser();
  const found = getShade(shadeId);
  if (!user || !found) return false;
  await (await getBackend()).addToCart(user.uid, shadeId, qty, found.shade.name || "");
  return true;
}
export async function setQty(shadeId, qty) {
  const user = getUser();
  if (user) await (await getBackend()).setCartQty(user.uid, shadeId, qty);
}
export async function remove(shadeId) {
  const user = getUser();
  if (user) await (await getBackend()).removeFromCart(user.uid, shadeId);
}

// ---------- Orders ----------
// address = { fullName, phone, city, address }. No payment is taken.
export async function placeOrder(address) {
  const user = getUser();
  const { items, subtotal } = state();
  if (!user || !items.length) throw new Error("empty-bag");
  const order = {
    items: items.map((i) => ({
      id: i.id, name: i.line.name, shade: i.shade.name || "", code: i.shade.code || "",
      price: i.shade.price, qty: i.qty, image: i.shade.image,
    })),
    subtotal: Number(subtotal.toFixed(2)),
    address,
  };
  return (await getBackend()).placeOrder(user.uid, order);
}

export async function getOrders() {
  const user = getUser();
  return user ? (await getBackend()).getOrders(user.uid) : [];
}
