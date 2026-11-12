// =========================================================
// NEVERTI — auth.js
// Sign up / sign in / Google / reset password / sign out / auth state.
// Picks the backend: real Firebase when js/firebase-config.js has real keys,
// otherwise the local demo backend. The rest of the site only uses this file.
// =========================================================

import { firebaseConfig } from "./firebase-config.js";

export const hasFirebaseKeys = Boolean(firebaseConfig?.apiKey) && !/^PASTE/i.test(firebaseConfig.apiKey);

let backend = null;
let user = null;
let usingDemoBecauseOfError = false;
let known = false; // true once we know whether someone is signed in
const listeners = new Set();
let markReady;
export const ready = new Promise((resolve) => (markReady = resolve));

async function boot() {
  try {
    backend = await (hasFirebaseKeys ? import("./backend/firebase.js") : import("./backend/demo.js"));
  } catch (err) {
    // Firebase couldn't load (offline, wrong keys…): the site still works in demo mode
    console.error("Firebase could not start. Using demo mode.", err);
    usingDemoBecauseOfError = true;
    backend = await import("./backend/demo.js");
  }
  backend.onUser((u) => {
    user = u;
    known = true;
    markReady();
    listeners.forEach((cb) => cb(user));
  });
}
boot();

export const getBackend = () => ready.then(() => backend);
export const getUser = () => user;
export const isDemo = () => backend?.mode !== "firebase";
export const demoReason = () => (usingDemoBecauseOfError ? "error" : "no-keys");

// cb runs once the state is known (right away if it already is) and on every change
export function onAuth(cb) {
  listeners.add(cb);
  if (known) queueMicrotask(() => listeners.has(cb) && cb(user));
  return () => listeners.delete(cb);
}

// ---------- Friendly messages ----------
const MESSAGES = {
  "auth/invalid-credential": "That email and password don't match. Check them, or reset your password.",
  "auth/wrong-password": "That email and password don't match. Check them, or reset your password.",
  "auth/user-not-found": "That email and password don't match. Check them, or reset your password.",
  "auth/email-already-in-use": "This email already has an account. Sign in instead.",
  "auth/weak-password": "Choose a password with at least 6 characters.",
  "auth/invalid-email": "Enter a full email address, like name@example.com.",
  "auth/missing-password": "Enter your password.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes, or reset your password.",
  "auth/popup-closed-by-user": "The Google window closed before you finished. Try again.",
  "auth/cancelled-popup-request": "The Google window closed before you finished. Try again.",
  "auth/popup-blocked": "Your browser blocked the Google window. Allow pop-ups for this site and try again.",
  "auth/network-request-failed": "No connection. Check your internet and try again.",
  "auth/unauthorized-domain": "This web address isn't allowed yet. Add it to Authorized domains in Firebase.",
  "demo/google-unavailable": "Google sign-in needs real Firebase keys. For now, use your email.",
  "demo/reset-unavailable": "Password reset emails need real Firebase keys. In demo mode, create a new account instead.",
  "permission-denied": "Firebase refused this action. Check the Firestore rules in the setup guide.",
};
export const friendlyError = (err) => MESSAGES[err?.code] || "Something went wrong. Try again in a moment.";

// ---------- Actions ----------
const call = async (name, ...args) => {
  await ready;
  return backend[name](...args);
};

export const signUp = (details) => call("signUp", details);
export const signIn = (details) => call("signIn", details);
export const signInWithGoogle = () => call("google");
export const resetPassword = (email) => call("reset", email);
export const signOut = () => call("signOut");
export const subscribeNewsletter = (email) => call("subscribeNewsletter", email);

// Shade Match and other saved details
export const getProfile = () => (user ? call("getProfile", user.uid) : Promise.resolve({}));
export const saveProfile = (patch) => (user ? call("saveProfile", user.uid, patch) : Promise.reject(new Error("signed-out")));

// ---------- Protected pages (checkout, account) ----------
// Signed out → back to the home page with the login window open;
// after signing in, the visitor returns here.
export async function requireUser() {
  await ready;
  if (user) return user;
  try { sessionStorage.setItem("neverti.returnTo", location.pathname.split("/").pop() + location.search); } catch { /* ignore */ }
  location.replace("index.html?login=1");
  return new Promise(() => {}); // stop the page script
}
