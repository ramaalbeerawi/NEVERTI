// =========================================================
// NEVERTI — backend/firebase.js
// REAL MODE: Firebase Authentication + Cloud Firestore.
// Same interface as backend/demo.js. Loaded only when
// js/firebase-config.js holds real keys.
//
// Firestore layout (see FIREBASE_SETUP.md for the security rules):
//   users/{uid}                    { name, email, createdAt, profile fields… }
//   users/{uid}/cart/{shadeId}     { productId, shade, qty, addedAt }
//   users/{uid}/orders/{orderId}   { items[], subtotal, address{}, status, createdAt }
//   newsletter/{autoId}            { email, createdAt }
// =========================================================

import { firebaseConfig } from "../firebase-config.js";

export const mode = "firebase";

const VERSION = "11.0.2"; // pinned
const BASE = `https://www.gstatic.com/firebasejs/${VERSION}/`;
const [{ initializeApp }, A, F] = await Promise.all([
  import(BASE + "firebase-app.js"),
  import(BASE + "firebase-auth.js"),
  import(BASE + "firebase-firestore.js"),
]);

const app = initializeApp(firebaseConfig);
const auth = A.getAuth(app);
const db = F.getFirestore(app);

const publicUser = (u) => (u ? { uid: u.uid, name: u.displayName || "", email: u.email || "" } : null);
const userDoc = (uid) => F.doc(db, "users", uid);

// ---------- Accounts ----------
export function onUser(cb) {
  return A.onAuthStateChanged(auth, (u) => cb(publicUser(u)));
}

export async function signUp({ name, email, password }) {
  const cred = await A.createUserWithEmailAndPassword(auth, email.trim(), password);
  await A.updateProfile(cred.user, { displayName: name.trim() });
  await F.setDoc(userDoc(cred.user.uid), {
    name: name.trim(), email: cred.user.email, createdAt: F.serverTimestamp(),
  });
  return publicUser({ ...cred.user, displayName: name.trim() });
}

export async function signIn({ email, password }) {
  const cred = await A.signInWithEmailAndPassword(auth, email.trim(), password);
  return publicUser(cred.user);
}

export async function google() {
  const cred = await A.signInWithPopup(auth, new A.GoogleAuthProvider());
  // First Google sign-in: create the profile document
  const ref = userDoc(cred.user.uid);
  if (!(await F.getDoc(ref)).exists()) {
    await F.setDoc(ref, { name: cred.user.displayName || "", email: cred.user.email, createdAt: F.serverTimestamp() });
  }
  return publicUser(cred.user);
}

export const reset = (email) => A.sendPasswordResetEmail(auth, email.trim());
export const signOut = () => A.signOut(auth);

// ---------- Bag (live: the same on every device) ----------
export function watchCart(uid, cb) {
  return F.onSnapshot(
    F.collection(db, "users", uid, "cart"),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, qty: d.data().qty }))),
    (err) => console.error("Bag listener:", err)
  );
}

export async function addToCart(uid, id, qty = 1, shadeName = "") {
  await F.setDoc(
    F.doc(db, "users", uid, "cart", id),
    { productId: id, shade: shadeName, qty: F.increment(qty), addedAt: F.serverTimestamp() },
    { merge: true }
  );
}

export async function setCartQty(uid, id, qty) {
  const ref = F.doc(db, "users", uid, "cart", id);
  if (qty < 1) await F.deleteDoc(ref);
  else await F.updateDoc(ref, { qty: Math.min(10, qty) });
}

export const removeFromCart = (uid, id) => F.deleteDoc(F.doc(db, "users", uid, "cart", id));

// ---------- Orders ----------
// Saves the order and empties the bag in one step (all or nothing)
export async function placeOrder(uid, order) {
  const orderRef = F.doc(F.collection(db, "users", uid, "orders"));
  const batch = F.writeBatch(db);
  batch.set(orderRef, { ...order, status: "Placed", createdAt: F.serverTimestamp() });
  const cart = await F.getDocs(F.collection(db, "users", uid, "cart"));
  cart.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return "NV-" + orderRef.id.slice(0, 8).toUpperCase();
}

export async function getOrders(uid) {
  const snap = await F.getDocs(F.query(F.collection(db, "users", uid, "orders"), F.orderBy("createdAt", "desc")));
  return snap.docs.map((d) => {
    const o = d.data();
    return { ...o, id: "NV-" + d.id.slice(0, 8).toUpperCase(), createdAt: o.createdAt?.toDate?.().toISOString() || new Date().toISOString() };
  });
}

// ---------- Profile ----------
export async function getProfile(uid) {
  const snap = await F.getDoc(userDoc(uid));
  return snap.exists() ? snap.data().profile || {} : {};
}
export const saveProfile = (uid, patch) =>
  F.setDoc(userDoc(uid), { profile: patch }, { merge: true });

// ---------- Newsletter ----------
export const subscribeNewsletter = (email) =>
  F.addDoc(F.collection(db, "newsletter"), { email, createdAt: F.serverTimestamp() });
