// =========================================================
// NEVERTI — backend/demo.js
// DEMO MODE: accounts, bag, orders and profile live in this browser
// (localStorage). Same interface as backend/firebase.js, so the rest of
// the site doesn't know the difference.
// =========================================================

export const mode = "demo";

const KEY = {
  users: "neverti.demo.users",
  session: "neverti.demo.session",
  data: (uid) => `neverti.demo.data.${uid}`,
  news: "neverti.demo.newsletter",
};

const read = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } };

// Same error codes as Firebase, so auth.js can show one set of messages
const fail = (code) => { const e = new Error(code); e.code = code; throw e; };

async function hash(text) {
  try {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return btoa(unescape(encodeURIComponent(text))); // insecure pages: demo only
  }
}

const publicUser = (u) => (u ? { uid: u.uid, name: u.name, email: u.email } : null);
const dataOf = (uid) => read(KEY.data(uid), { cart: {}, orders: [], profile: {} });

// ---------- Change listeners ----------
const userListeners = new Set();
const cartListeners = new Set(); // { uid, cb }
const orderListeners = new Set();

function currentUser() {
  const uid = read(KEY.session, null);
  return publicUser(read(KEY.users, []).find((u) => u.uid === uid));
}
const emitUser = () => userListeners.forEach((cb) => cb(currentUser()));
const emitCart = (uid) => cartListeners.forEach((l) => l.uid === uid && l.cb(cartList(uid)));
const cartList = (uid) => Object.entries(dataOf(uid).cart).map(([id, qty]) => ({ id, qty }));

// Another tab changed something: refresh
window.addEventListener("storage", (e) => {
  if (e.key === KEY.session) emitUser();
  if (e.key?.startsWith("neverti.demo.data.")) {
    const uid = e.key.replace("neverti.demo.data.", "");
    emitCart(uid);
  }
});

// ---------- Accounts ----------
export function onUser(cb) {
  userListeners.add(cb);
  queueMicrotask(() => cb(currentUser()));
  return () => userListeners.delete(cb);
}

export async function signUp({ name, email, password }) {
  email = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) fail("auth/invalid-email");
  if (password.length < 6) fail("auth/weak-password");
  const users = read(KEY.users, []);
  if (users.some((u) => u.email === email)) fail("auth/email-already-in-use");
  const user = {
    uid: "demo-" + crypto.randomUUID().slice(0, 12),
    name: name.trim(), email, hash: await hash(email + password), createdAt: new Date().toISOString(),
  };
  write(KEY.users, [...users, user]);
  write(KEY.session, user.uid);
  emitUser();
  return publicUser(user);
}

export async function signIn({ email, password }) {
  email = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) fail("auth/invalid-email");
  const user = read(KEY.users, []).find((u) => u.email === email);
  if (!user || user.hash !== (await hash(email + password))) fail("auth/invalid-credential");
  write(KEY.session, user.uid);
  emitUser();
  return publicUser(user);
}

export async function google() {
  fail("demo/google-unavailable"); // Google needs real Firebase
}

export async function reset(email) {
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) fail("auth/invalid-email");
  fail("demo/reset-unavailable"); // demo mode can't send email
}

export async function signOut() {
  write(KEY.session, null);
  emitUser();
}

// ---------- Bag ----------
export function watchCart(uid, cb) {
  const listener = { uid, cb };
  cartListeners.add(listener);
  queueMicrotask(() => cb(cartList(uid)));
  return () => cartListeners.delete(listener);
}

function changeData(uid, fn) {
  const data = dataOf(uid);
  fn(data);
  write(KEY.data(uid), data);
}

export async function addToCart(uid, id, qty = 1) {
  changeData(uid, (d) => { d.cart[id] = Math.min(10, (d.cart[id] || 0) + qty); });
  emitCart(uid);
}
export async function setCartQty(uid, id, qty) {
  changeData(uid, (d) => { qty < 1 ? delete d.cart[id] : (d.cart[id] = Math.min(10, qty)); });
  emitCart(uid);
}
export async function removeFromCart(uid, id) {
  changeData(uid, (d) => { delete d.cart[id]; });
  emitCart(uid);
}

// ---------- Orders ----------
export async function placeOrder(uid, order) {
  const id = "NV-" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  changeData(uid, (d) => {
    d.orders.unshift({ id, ...order, status: "Placed", createdAt: new Date().toISOString() });
    d.cart = {};
  });
  emitCart(uid);
  return id;
}
export async function getOrders(uid) {
  return dataOf(uid).orders;
}

// ---------- Profile (shade match is saved here) ----------
export async function getProfile(uid) {
  return dataOf(uid).profile;
}
export async function saveProfile(uid, patch) {
  changeData(uid, (d) => { d.profile = { ...d.profile, ...patch }; });
}

// ---------- Newsletter ----------
export async function subscribeNewsletter(email) {
  if (!/^\S+@\S+\.\S+$/.test(email)) fail("auth/invalid-email");
  const list = read(KEY.news, []);
  if (!list.includes(email)) write(KEY.news, [...list, email]);
}
