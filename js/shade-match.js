// =========================================================
// NEVERTI — shade-match.js
// Find my shade. A selfie (camera or upload) → MediaPipe finds the face → we measure the
// skin on the cheeks, forehead and jaw (middle luminance percentiles only: no highlights,
// shadows or freckles) → CIELAB → depth and undertone → the CLOSEST foundation and concealer
// (CIEDE2000, preferring the same undertone), and a blush and lipstick that suit the
// undertone and depth. The result can be corrected by hand and is saved (device + account).
//
// Honest limits: the light in the photo changes the color we measure. We warn about uneven,
// dark or bright light, show a confidence level, and never promise an "exact" match.
// =========================================================

import { LINES, IMAGES } from "./products.js";
import { priceHTML, productUrl } from "./product-tile.js";
import { loadFaceLandmarker } from "./tryon/face.js";
import { ready, getUser, friendlyError } from "./auth.js";
import { saveSkin } from "./skin-profile.js";
import { openLogin } from "./header.js";

const $ = (id) => document.getElementById(id);
const canvas = $("canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const video = $("video");
const statusBox = $("status");

// ---------- Colour maths (sRGB ↔ CIE Lab, D65) ----------
const toLinear = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const fromLinear = (v) => 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
function rgbToLab(r, g, b) {
  const R = toLinear(r), G = toLinear(g), B = toLinear(b);
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, Y = R * 0.2126 + G * 0.7152 + B * 0.0722, Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
function labToRgb(L, a, b) {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const inv = (t) => (t * t * t > 0.008856 ? t * t * t : (t - 16 / 116) / 7.787);
  const X = inv(fx) * 0.95047, Y = inv(fy), Z = inv(fz) * 1.08883;
  const lin = [X * 3.2406 + Y * -1.5372 + Z * -0.4986, X * -0.9689 + Y * 1.8758 + Z * 0.0415, X * 0.0557 + Y * -0.204 + Z * 1.057];
  return lin.map((v) => Math.max(0, Math.min(255, Math.round(fromLinear(Math.max(0, v))))));
}
const hexToRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgbToHex = ([r, g, b]) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
const fromPolar = (L, C, hDeg) => [L, C * Math.cos((hDeg * Math.PI) / 180), C * Math.sin((hDeg * Math.PI) / 180)];
const hueOf = (a, b) => (Math.atan2(b, a) * 180) / Math.PI; // signed angle, like the undertone table

// CIEDE2000: the standard way to say how different two colors look
function deltaE00(l1, l2) {
  const rad = (d) => (d * Math.PI) / 180;
  const [L1, a1, b1] = l1, [L2, a2, b2] = l2;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h1p = (Math.atan2(b1, a1p) * 180 / Math.PI + 360) % 360, h2p = (Math.atan2(b2, a2p) * 180 / Math.PI + 360) % 360;
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp / 2));
  const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hbp;
  if (C1p * C2p === 0) hbp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbp = (h1p + h2p) / 2;
  else hbp = (h1p + h2p + (h1p + h2p < 360 ? 360 : -360)) / 2;
  const T = 1 - 0.17 * Math.cos(rad(hbp - 30)) + 0.24 * Math.cos(rad(2 * hbp)) + 0.32 * Math.cos(rad(3 * hbp + 6)) - 0.2 * Math.cos(rad(4 * hbp - 63));
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(rad(2 * dTheta)) * Rc;
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}
const deltaE76 = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

// ---------- Depth and undertone ----------
const DEPTHS = [[72, "Light"], [62, "Light-medium"], [52, "Medium"], [42, "Tan"], [-1, "Deep"]];
const depthLabel = (L) => DEPTHS.find(([min]) => L >= min)[1];
// Skin undertone from the CIELAB hue angle: < 52° cool · 52–62° neutral · > 62° warm
const undertoneOf = (a, b) => { const h = hueOf(a, b); return h < 52 ? "cool" : h <= 62 ? "neutral" : "warm"; };
const UNDER_NOTE = { cool: "pink or rosy", neutral: "a balance of pink and golden", warm: "golden or peachy" };
const cap = (s) => s[0].toUpperCase() + s.slice(1);

// ---------- Candidate products ----------
const FOUNDATION = ["foundation-soft-matte", "foundation-glow", "bb-cream"];
const CONCEALER = ["concealer-serum", "concealer-stick"];
const BLUSH = ["cream-blush", "liquid-blush", "powder-blush", "powder-cream-blush", "glowy-blush"];
const LIPSTICK = ["matte-liquid-lipstick", "matte-lipstick", "satin-lipstick", "shine-lipstick", "lip-tint"];

const labCache = new Map();
function candidates(materials) {
  const out = [];
  for (const line of LINES) {
    if (!materials.includes(line.material)) continue;
    for (const shade of line.shades) {
      if (!shade.hex) continue;
      if (!labCache.has(shade.id)) labCache.set(shade.id, rgbToLab(...hexToRgb(shade.hex)));
      out.push({ line, shade, lab: labCache.get(shade.id) });
    }
  }
  return out;
}
// The closest shade of each product line, best first. Same undertone is preferred.
function closest(cands, target, count, skinUndertone) {
  const best = new Map();
  for (const c of cands) {
    let d = deltaE00(c.lab, target);
    const u = c.shade.undertone;
    if (skinUndertone && u && u !== skinUndertone) d += u === "neutral" || skinUndertone === "neutral" ? 1.2 : 3; // prefer the same undertone
    if (!c.shade.inStock) d += 6;                                                                                  // sold-out shades come last
    if (!best.has(c.line.id) || d < best.get(c.line.id).d) best.set(c.line.id, { ...c, d, raw: deltaE00(c.lab, target) });
  }
  return [...best.values()].sort((a, b) => a.d - b.d).slice(0, count);
}

// ---------- Measuring the skin ----------
// The pixels of a small circle, keeping only the MIDDLE luminance percentiles (25–75%), so
// highlights, shadows and freckles drop out. Result: the median color of what is left.
function sampleSpot(data, W, H, cx, cy, r) {
  const px = [];
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(H - 1, Math.ceil(cy + r)); y++) {
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(W - 1, Math.ceil(cx + r)); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
      const i = (y * W + x) << 2, R = data[i], G = data[i + 1], B = data[i + 2];
      if (G < B - 6) continue; // not skin (pink headband, blue…)
      px.push([R, G, B, 0.299 * R + 0.587 * G + 0.114 * B]);
    }
  }
  if (px.length < 40) return null;
  px.sort((p, q) => p[3] - q[3]);
  const mid = px.slice(Math.floor(px.length * 0.25), Math.ceil(px.length * 0.75));
  const median = (c) => { const v = mid.map((p) => p[c]).sort((p, q) => p - q); return v[Math.floor(v.length / 2)]; };
  return { rgb: [median(0), median(1), median(2)], luma: median(3), n: mid.length };
}

function measure(landmarks, manual) {
  const W = canvas.width, H = canvas.height;
  const data = ctx.getImageData(0, 0, W, H).data; // the clean photo (the rings are drawn afterwards)
  const P = (i) => ({ x: landmarks[i].x * W, y: landmarks[i].y * H });
  const avg = (ids) => ({ x: ids.reduce((s, i) => s + P(i).x, 0) / ids.length, y: ids.reduce((s, i) => s + P(i).y, 0) / ids.length });
  const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const faceW = Math.hypot(P(234).x - P(454).x, P(234).y - P(454).y);
  const r = faceW * 0.035;
  const spots = manual
    ? [{ name: "spot", ...manual, r: faceW * 0.03, w: 1 }]
    : [
        { name: "left cheek", ...avg([50, 101, 118]), r, w: 1 },
        { name: "right cheek", ...avg([280, 330, 347]), r, w: 1 },
        { name: "forehead", ...avg([151, 9]), r: r * 0.9, w: 0.7 },
        { name: "left jaw", ...mix(P(61), P(172), 0.55), r: r * 0.85, w: 0.8 },
        { name: "right jaw", ...mix(P(291), P(397), 0.55), r: r * 0.85, w: 0.8 },
      ];
  let reads = spots.map((s) => ({ s, v: sampleSpot(data, W, H, s.x, s.y, s.r) })).filter((x) => x.v).map((x) => ({ ...x, lab: rgbToLab(...x.v.rgb) }));
  if (!reads.length) return null;

  // Drop a spot that disagrees with the others (hair shadow, a blemish…)
  if (reads.length >= 4) {
    const med = [0, 1, 2].map((c) => reads.map((x) => x.lab[c]).sort((p, q) => p - q)[Math.floor(reads.length / 2)]);
    const kept = reads.filter((x) => deltaE76(x.lab, med) < 12);
    if (kept.length >= 3) reads = kept;
  }
  const total = reads.reduce((t, x) => t + x.s.w, 0);
  const lab = [0, 1, 2].map((c) => reads.reduce((t, x) => t + x.lab[c] * x.s.w, 0) / total);
  const rgb = labToRgb(...lab);

  // Is the light OK? How sure are we?
  const warnings = [];
  const luma = (name) => reads.find((x) => x.s.name === name)?.v.luma;
  const left = luma("left cheek"), right = luma("right cheek"), forehead = luma("forehead");
  if (left && right && Math.abs(left - right) / ((left + right) / 2) > 0.15) warnings.push("The light on your face is uneven. Face a window, or move away from strong light on one side.");
  if (forehead && left && right && Math.abs(forehead - (left + right) / 2) / ((left + right) / 2) > 0.2) warnings.push("Shine or shadow on your forehead may affect the result.");
  if (lab[0] < 28) warnings.push("The photo is quite dark. Try again with more light.");
  if (lab[0] > 90) warnings.push("The photo looks overexposed. Lower the brightness or move away from direct light.");
  let spread = 0;
  for (const p of reads) for (const q of reads) spread = Math.max(spread, deltaE76(p.lab, q.lab));
  const score = (spread < 6 ? 2 : spread < 10 ? 1 : 0) + (reads.length >= 3 ? 1 : 0) - warnings.length;
  const confidence = manual ? "Medium" : score >= 3 ? "High" : score >= 1 ? "Medium" : "Low";
  return { rgb, lab, warnings, confidence, spread, spots: reads.map((x) => x.s) };
}

// ---------- State ----------
let landmarker = null;
let face = null;            // { landmarks }
let measured = null;
let manualPoint = null;     // a spot the visitor tapped
let source = "model";
let stream = null;
let uploaded = null;
let switchId = 0;
let picks = [];
let photoCanvas = null;     // the clean photo, so the rings can be redrawn

// =========================================================
// Messages
// =========================================================
function showStatus(text, actions = []) {
  $("status-text").textContent = text;
  const box = $("status-actions");
  box.innerHTML = "";
  actions.forEach(({ label, onClick, primary }) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `btn ${primary ? "btn--primary" : ""}`;
    b.textContent = label;
    b.addEventListener("click", onClick);
    box.append(b);
  });
  statusBox.hidden = false;
}
const hideStatus = () => (statusBox.hidden = true);
const NO_FACE = "We can't find a face in this photo. Try a clear, front-facing photo in good light.";

// =========================================================
// Drawing the photo and the places we measured
// =========================================================
function drawPhoto(el) {
  const sw = el.videoWidth || el.naturalWidth || el.width, sh = el.videoHeight || el.naturalHeight || el.height;
  const scale = Math.min(1, 1400 / Math.max(sw, sh));
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
}
function drawRings() {
  if (!measured) return;
  ctx.save();
  ctx.lineWidth = Math.max(2, canvas.width / 450);
  for (const s of measured.spots) {
    ctx.strokeStyle = "rgba(255,255,255,.95)";
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "rgba(87,36,43,.7)";
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r + ctx.lineWidth, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

// =========================================================
// Analysing a photo
// =========================================================
function analyze(el, id) {
  drawPhoto(el);
  photoCanvas = document.createElement("canvas");
  photoCanvas.width = canvas.width; photoCanvas.height = canvas.height;
  photoCanvas.getContext("2d").drawImage(canvas, 0, 0);

  const found = landmarker.detect(canvas).faceLandmarks[0];
  if (id !== switchId) return;
  if (!found) {
    face = null; measured = null;
    $("result").hidden = true;
    showStatus(NO_FACE, source === "upload" ? [{ label: "Choose another photo", onClick: () => $("file").click(), primary: true }] : []);
    return;
  }
  face = { landmarks: found };
  manualPoint = null;
  hideStatus();
  update(true);
}

function update(resetSliders = false) {
  ctx.drawImage(photoCanvas, 0, 0);
  measured = measure(face.landmarks, manualPoint);
  if (!measured) { showStatus("We couldn't read the skin color there. Tap another spot on your face."); return; }
  drawRings();
  if (resetSliders) { $("adj-depth").value = 0; $("adj-under").value = 0; }
  render();
}

// =========================================================
// The result: skin, adjustments, picks
// =========================================================
function adjustedLab() {
  const [L, a, b] = measured.lab;
  const depth = Number($("adj-depth").value), under = Number($("adj-under").value);
  return [L + depth, a - under * 0.25, b + under * 0.9];
}

function targets(lab, under) {
  const L = lab[0];
  const hue = { cool: 12, neutral: 24, warm: 36 }[under]; // the lip and cheek hue that flatters each undertone
  const deep = L < 50;
  return {
    foundation: lab,
    concealer: [Math.min(95, L + 3), lab[1], lab[2] + 1],
    blush: fromPolar(Math.max(30, L - (deep ? 10 : 13)), deep ? 42 : 36, hue - 4),
    lipEveryday: fromPolar(Math.max(28, L - 22), 30, hue - 14),
    lipStatement: fromPolar(34 + (L - 60) * 0.1, 56, hue - 22),
  };
}

const qualityLabel = (d) => (d <= 4 ? "Excellent match" : d <= 7 ? "Good match" : "Closest we have");
const tag = (u) => (u ? `<span class="tag tag--${u}">${cap(u)}</span>` : "");

function render() {
  const lab = adjustedLab();
  const [L, a, b] = lab;
  const depth = depthLabel(L), under = undertoneOf(a, b);
  $("result").hidden = false;
  $("skin-swatch").style.background = rgbToHex(labToRgb(L, a, b));
  $("skin-depth").textContent = `${depth} skin`;
  $("skin-under").textContent = `${cap(under)} undertone: ${UNDER_NOTE[under]}`;
  $("skin-confidence").textContent = `Confidence: ${measured.confidence}. Closest match, not an exact one.`;
  $("warnings").innerHTML = measured.warnings.map((w) => `<li>${w}</li>`).join("");

  const T = targets(lab, under);
  const found = closest(candidates(FOUNDATION), T.foundation, 3, under);
  const conc = closest(candidates(CONCEALER), T.concealer, 2, under);
  const blush = closest(candidates(BLUSH), T.blush, 1, under);
  const lips = closest(candidates(LIPSTICK), T.lipEveryday, 1, under);
  const bold = closest(candidates(LIPSTICK), T.lipStatement, 2, under).filter((c) => !lips.some((l) => l.shade.id === c.shade.id));

  picks = [
    ...found.map((c, i) => ({ kind: i === 0 ? "Foundation · closest match" : "Foundation", ...c, note: qualityLabel(c.raw) })),
    ...conc.map((c, i) => ({ kind: i === 0 ? "Concealer · closest match" : "Concealer", ...c, note: qualityLabel(c.raw) })),
    ...blush.map((c) => ({ kind: "Blush", ...c, note: "Suits your depth and undertone" })),
    ...lips.map((c) => ({ kind: "Lipstick · everyday", ...c, note: "A flattering, natural shade" })),
    ...bold.slice(0, 1).map((c) => ({ kind: "Lipstick · statement", ...c, note: "A deeper, bolder shade" })),
  ];

  $("picks").innerHTML = picks.map(({ kind, line, shade, note }) => `
    <article class="pick">
      <a class="pick__photo" href="${productUrl(line, shade)}" tabindex="-1" aria-hidden="true">
        <img src="${shade.image}" alt="" width="88" height="88" loading="lazy">
      </a>
      <div class="pick__info">
        <p class="pick__kind">${kind}</p>
        <a class="pick__name" href="${productUrl(line, shade)}">${line.name}</a>
        <p class="pick__shade"><span class="dot dot--mini" style="--dot:${shade.hex}" aria-hidden="true"></span>
          ${shade.name || ""}${shade.code ? ` <span class="wearing__code">${shade.code}</span>` : ""} ${tag(shade.undertone)}</p>
        <p class="pick__note">${line.finishLabel ? line.finishLabel + " · " : ""}${note}${shade.inStock ? "" : " · sold out"}</p>
        ${priceHTML(shade)}
      </div>
      <div class="pick__actions">
        <button class="btn btn--small" type="button" data-add-to-bag="${shade.id}" ${shade.inStock ? "" : "disabled"}>${shade.inStock ? "Add to bag" : "Sold out"}</button>
        ${line.tryOn ? `<a class="link-btn" href="try-on.html?product=${line.id}&amp;shade=${shade.id}">Try on</a>` : ""}
      </div>
    </article>`).join("");
}

["adj-depth", "adj-under"].forEach((id) => $(id).addEventListener("input", () => measured && render()));
$("adj-reset").addEventListener("click", () => { manualPoint = null; if (face) update(true); });

// Tap a spot on the photo to measure there instead
canvas.addEventListener("click", (e) => {
  if (!face || canvas.classList.contains("is-mirrored")) return;
  const rect = canvas.getBoundingClientRect();
  manualPoint = { x: ((e.clientX - rect.left) / rect.width) * canvas.width, y: ((e.clientY - rect.top) / rect.height) * canvas.height };
  update(true);
});

// =========================================================
// Try the picks on / save them
// =========================================================
$("try-picks").addEventListener("click", () => {
  const chosen = [];
  const seen = new Set();
  for (const p of picks) {
    const key = p.kind.split(" · ")[0];
    if (seen.has(key) || !p.line.tryOn || p.kind.includes("statement")) continue;
    seen.add(key);
    chosen.push(p.shade.id);
  }
  try { sessionStorage.setItem("neverti.tryLook", JSON.stringify(chosen)); } catch { /* ignore */ }
  location.href = "try-on.html";
});

$("save").addEventListener("click", async () => {
  const message = $("save-message");
  await ready;
  const lab = adjustedLab();
  const under = undertoneOf(lab[1], lab[2]);
  const match = {
    depthLabel: depthLabel(lab[0]),
    undertone: under,
    lab: lab.map((v) => Math.round(v * 10) / 10),
    hueAngle: Math.round(hueOf(lab[1], lab[2]) * 10) / 10,
    hex: rgbToHex(labToRgb(...lab)),
    confidence: measured.confidence,
    picks: picks.map((p) => ({ id: p.shade.id, kind: p.kind.split(" · ")[0] + (p.kind.includes("·") ? ` (${p.kind.split(" · ")[1]})` : "") })),
    savedAt: new Date().toISOString(),
  };
  try {
    message.textContent = "Saving…";
    // On this device always (so the store can show "Matches your undertone"), and in the account when signed in
    await saveSkin(match);
    message.textContent = getUser()
      ? "Saved to your account. The store now shows which shades match your undertone."
      : "Saved on this device. Sign in to keep it in your account too.";
    if (!getUser()) $("save-signin").hidden = false;
  } catch (err) {
    message.textContent = friendlyError(err);
  }
});
$("save-signin").addEventListener("click", () => openLogin("Sign in to keep your shade in your account."));

// =========================================================
// Sources: our model, an uploaded photo, the camera
// =========================================================
const loadImage = (src) => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = src; });

function stopCamera() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  video.srcObject = null;
  canvas.classList.remove("is-mirrored");
  $("capture").hidden = true;
}

async function startCamera(id) {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    showStatus("The camera only works on a secure page. Open the site with Live Server (localhost) or over https.");
    return;
  }
  showStatus("Allow camera access to start. Your browser will ask you.");
  try {
    const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } }, audio: false });
    if (id !== switchId) return s.getTracks().forEach((t) => t.stop());
    stream = s;
    video.srcObject = s;
    await video.play();
    canvas.classList.add("is-mirrored"); // like a mirror while you line up
    $("capture").hidden = false;
    $("result").hidden = true;
    hideStatus();
    const loop = () => {
      if (id !== switchId || !stream) return;
      if (video.readyState >= 2) drawPhoto(video);
      requestAnimationFrame(loop);
    };
    loop();
  } catch (err) {
    if (id !== switchId) return;
    const retry = [{ label: "Try again", onClick: () => select("camera"), primary: true }, { label: "Use our model", onClick: () => select("model") }];
    if (err.name === "NotAllowedError" || err.name === "SecurityError") showStatus("Camera access is blocked. Click the camera icon in the address bar, choose Allow, then try again.", retry);
    else if (err.name === "NotFoundError" || err.name === "OverconstrainedError") showStatus("No camera was found on this device. Upload a photo instead.", retry.slice(1));
    else if (err.name === "NotReadableError") showStatus("Another app is using the camera. Close it, then try again.", retry);
    else showStatus("The camera couldn't start. Try again, or upload a photo.", retry);
  }
}

$("capture").addEventListener("click", () => {
  const still = document.createElement("canvas");
  still.width = video.videoWidth; still.height = video.videoHeight;
  still.getContext("2d").drawImage(video, 0, 0);
  const id = ++switchId;
  stopCamera();
  $("change-photo").hidden = true;
  analyze(still, id);
});

$("file").addEventListener("change", async () => {
  const file = $("file").files[0];
  $("file").value = "";
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showStatus("That file isn't a photo. Choose a JPG or PNG image.", [{ label: "Choose a photo", onClick: () => $("file").click(), primary: true }]);
    return;
  }
  const url = URL.createObjectURL(file);
  try {
    uploaded = await loadImage(url);
    if (source !== "upload") return select("upload");
    analyze(uploaded, switchId);
  } catch {
    showStatus("This photo couldn't be opened. Try a JPG or PNG.", [{ label: "Choose a photo", onClick: () => $("file").click(), primary: true }]);
  } finally {
    URL.revokeObjectURL(url);
  }
});

async function select(next) {
  if (!landmarker) return;
  const id = ++switchId;
  source = next;
  document.querySelectorAll("[data-source]").forEach((t) => {
    const on = t.dataset.source === next;
    t.setAttribute("aria-selected", String(on));
    t.tabIndex = on ? 0 : -1;
  });
  stopCamera();
  $("change-photo").hidden = next !== "upload";
  $("result").hidden = true;
  face = null; measured = null;
  if (next === "model") { showStatus("Loading our model…"); analyze(await loadImage(IMAGES.model), id); }
  if (next === "upload") {
    if (uploaded) analyze(uploaded, id);
    else showStatus("Choose a clear, front-facing photo of your face.", [{ label: "Choose a photo", onClick: () => $("file").click(), primary: true }]);
  }
  if (next === "camera") await startCamera(id);
}

const tabs = [...document.querySelectorAll("[data-source]")];
tabs.forEach((tab, i) => {
  const choose = (t) => { if (t.dataset.source === "upload" && !uploaded) $("file").click(); select(t.dataset.source); };
  tab.addEventListener("click", () => choose(tab));
  tab.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
    next.focus();
    choose(next);
  });
});

// ---------- Start ----------
showStatus("Loading…");
try {
  landmarker = await loadFaceLandmarker();
} catch (err) {
  console.error(err);
  showStatus("We couldn't load the face finder. Check your internet connection, then reload.", [{ label: "Reload", onClick: () => location.reload(), primary: true }]);
  throw err;
}
await select("model");
