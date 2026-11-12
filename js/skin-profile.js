// =========================================================
// NEVERTI — skin-profile.js
// The visitor's skin profile from Find my shade: depth and undertone.
// Saved on this device (so it works for guests too) and, when signed in, in the account.
// Used for "Matches your undertone" badges, the "My undertone" filter and the try-on hint.
// =========================================================

import { ready, getUser, getProfile, saveProfile } from "./auth.js";

const KEY = "neverti.skinProfile";
let current = null;
const listeners = new Set();

const readDevice = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
current = readDevice();

const emit = () => listeners.forEach((cb) => cb(current));

// Called with the profile now (may be null) and every time it changes
export function onSkinProfile(cb) {
  listeners.add(cb);
  cb(current);
  return () => listeners.delete(cb);
}
export const getSkin = () => current;
export const myUndertone = () => current?.undertone || null; // "cool" | "neutral" | "warm"

// Signed in? The account's copy wins (it follows her across devices)
ready.then(async () => {
  if (!getUser()) return;
  try {
    const profile = await getProfile();
    if (profile?.shadeMatch) { current = profile.shadeMatch; emit(); }
  } catch { /* offline: keep the device copy */ }
});

// Save after Find my shade: always on the device, and in the account when signed in
export async function saveSkin(match) {
  current = match;
  try { localStorage.setItem(KEY, JSON.stringify(match)); } catch { /* storage blocked */ }
  emit();
  await ready;
  if (getUser()) await saveProfile({ shadeMatch: match });
}

// ---------- Hints ----------
const ORDER = { cool: 0, neutral: 1, warm: 2 };
// "Matches your undertone" | "Warmer than your undertone" | "Cooler than your undertone" | null
export function undertoneHint(shadeUndertone) {
  const mine = myUndertone();
  if (!mine || !shadeUndertone) return null;
  if (mine === shadeUndertone) return { kind: "match", text: "Matches your undertone" };
  return ORDER[shadeUndertone] > ORDER[mine]
    ? { kind: "warmer", text: "Warmer than your undertone" }
    : { kind: "cooler", text: "Cooler than your undertone" };
}

// Show or hide every "fit" label inside root: <p data-fit="cool,warm">
export function applyFitBadges(root = document) {
  const mine = myUndertone();
  root.querySelectorAll("[data-fit]").forEach((el) => {
    const has = mine && el.dataset.fit.split(",").includes(mine);
    el.hidden = !has;
    if (has) el.textContent = "Has shades for your undertone";
  });
}
onSkinProfile(() => applyFitBadges());
