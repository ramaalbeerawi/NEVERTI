// =========================================================
// NEVERTI — tryon/tryon.js
// The try-on page: choose the face (our model / your photo / your camera),
// find the face points with MediaPipe, and build a look from real products.
// The drawing itself is in makeup.js; how each product behaves is in materials.js.
// =========================================================

import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";
import { LINES, IMAGES, getLine, getShade, formatPrice, defaultShade } from "../products.js";
import { priceHTML, productUrl, undertoneTag } from "../product-tile.js";
import { undertoneHint, onSkinProfile } from "../skin-profile.js";
import { requestAdd } from "../account-ui.js";
import { MATERIALS, SLOT_ORDER, SLOT_LABEL, GROUPS } from "./materials.js";
import { createRenderer } from "./makeup.js";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const DEBUG = new URLSearchParams(location.search).get("debug") === "1";
const PHOTO_MAX = 2048;  // photos are drawn at full quality
const CAMERA_MAX = 480;  // the live camera uses a smaller working size to stay smooth

// ---------- Products that can be tried on (each has a material) ----------
const tryable = (group) =>
  LINES.filter((l) => l.tryOn === group && MATERIALS[l.material] && l.shades.some((s) => s.hex));
const slotOf = (line) => MATERIALS[line.material].slot;

// ---------- Page elements ----------
const $ = (id) => document.getElementById(id);
const canvas = $("canvas");
const video = $("video");
const statusBox = $("status");
const statusText = $("status-text");
const statusActions = $("status-actions");
const compareBtn = $("compare");
const fileInput = $("file");
const changePhoto = $("change-photo");
const productList = $("products");
const shadeCard = $("shade-card");
const dots = $("dots");
const shadeLabel = $("shade-label");

const renderer = createRenderer(canvas);

// ---------- State ----------
let landmarker = null;
let runningMode = "IMAGE";
let source = "model";        // "model" | "upload" | "camera"
let sourceEl = null;         // what we draw: <img>, <canvas> or <video>
let landmarks = null;        // face points for the current face
let before = false;          // holding "see before"
let stream = null;
let lastVideoTime = -1;
let switchId = 0;            // ignores slow results from an old source
let group = "lips";
let currentLineId = null;
const look = {};             // { slot: { lineId, shadeId, intensity } }
let uploadedPhoto = null;

// =========================================================
// Messages on the stage
// =========================================================
function showStatus(text, actions = []) {
  statusText.textContent = text;
  statusActions.innerHTML = "";
  actions.forEach(({ label, onClick, primary }) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `btn ${primary ? "btn--primary" : ""}`;
    b.textContent = label;
    b.addEventListener("click", onClick);
    statusActions.append(b);
  });
  statusBox.hidden = false;
}
const hideStatus = () => (statusBox.hidden = true);

const NO_FACE_PHOTO = "We can't find a face in this photo. Try a clear, front-facing photo in good light.";
const NO_FACE_CAMERA = "We can't see your face. Face the camera in good light.";

// =========================================================
// 1) MediaPipe Face Landmarker (GPU first, CPU if not available)
// =========================================================
async function loadLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);
  const options = (delegate) => ({
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: "IMAGE",
    numFaces: 1,
  });
  try {
    landmarker = await FaceLandmarker.createFromOptions(vision, options("GPU"));
  } catch {
    landmarker = await FaceLandmarker.createFromOptions(vision, options("CPU"));
  }
}
async function setMode(mode) {
  if (runningMode !== mode) {
    await landmarker.setOptions({ runningMode: mode });
    runningMode = mode;
  }
}

// =========================================================
// 2) Drawing
// =========================================================
// The look the engine needs: one entry per product being worn
function lookForEngine() {
  return SLOT_ORDER.filter((slot) => look[slot]).map((slot) => {
    const { line, shade } = getShade(look[slot].shadeId);
    return {
      material: line.material, hex: shade.hex, shadeName: shade.name || "",
      lineName: line.name, intensity: look[slot].intensity,
    };
  });
}

function draw(maxSide) {
  if (!sourceEl) return;
  const camera = source === "camera";
  renderer.render(sourceEl, landmarks, lookForEngine(), {
    before, debug: DEBUG, live: camera, maxSide: camera ? CAMERA_MAX : (maxSide || PHOTO_MAX),
  });
}

// Many changes in a row → one redraw per frame. While a slider is moving we draw a quick,
// smaller preview; when it stops for a moment we draw the full-quality picture.
let drawQueued = false, fullTimer = null;
function scheduleDraw({ quick = false } = {}) {
  if (source === "camera") return; // the camera loop redraws every frame anyway
  clearTimeout(fullTimer);
  if (!drawQueued) {
    drawQueued = true;
    requestAnimationFrame(() => { drawQueued = false; draw(quick ? 900 : undefined); });
  }
  if (quick) fullTimer = setTimeout(() => draw(), 220);
}

// =========================================================
// 3) Sources: our model, an uploaded photo, the camera
// =========================================================
const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

async function useStill(el, id) {
  await setMode("IMAGE");
  if (id !== switchId) return;
  sourceEl = el;
  landmarks = landmarker.detect(el).faceLandmarks[0] || null;
  draw();
  if (landmarks) hideStatus();
  else showStatus(NO_FACE_PHOTO, source === "upload" ? [{ label: "Choose another photo", onClick: () => fileInput.click(), primary: true }] : []);
}

async function showModel(id) {
  showStatus("Loading our model…");
  await useStill(await loadImage(IMAGES.model), id);
}

async function showUpload(id) {
  changePhoto.hidden = false;
  if (uploadedPhoto) return useStill(uploadedPhoto, id);
  sourceEl = null;
  canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  showStatus("Choose a clear, front-facing photo of your face.", [
    { label: "Choose a photo", onClick: () => fileInput.click(), primary: true },
  ]);
}

// A chosen file becomes a canvas no bigger than 1600 px (fast, and enough detail)
fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  fileInput.value = ""; // allow choosing the same file again
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showStatus("That file isn't a photo. Choose a JPG or PNG image.", [
      { label: "Choose a photo", onClick: () => fileInput.click(), primary: true },
    ]);
    return;
  }
  showStatus("Reading your photo…");
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    uploadedPhoto = c;
    if (source !== "upload") return selectSource("upload");
    await useStill(uploadedPhoto, switchId);
  } catch {
    showStatus("This photo couldn't be opened. Try a JPG or PNG.", [
      { label: "Choose a photo", onClick: () => fileInput.click(), primary: true },
    ]);
  } finally {
    URL.revokeObjectURL(url);
  }
});

// ---------- Camera ----------
async function showCamera(id) {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    showStatus("The camera only works on a secure page. Open the site with Live Server (localhost) or over https.");
    return;
  }
  showStatus("Allow camera access to start. Your browser will ask you.");
  try {
    const s = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } },
      audio: false,
    });
    if (id !== switchId) return s.getTracks().forEach((t) => t.stop()); // visitor already left the tab
    stream = s;
    video.srcObject = stream;
    await video.play();
    await setMode("VIDEO");
    if (id !== switchId) return;
    canvas.classList.add("is-mirrored");
    sourceEl = video;
    landmarks = null;
    lastVideoTime = -1;
    hideStatus();
    requestAnimationFrame(cameraLoop);
  } catch (err) {
    if (id !== switchId) return;
    const retry = [
      { label: "Try again", onClick: () => selectSource("camera", { force: true }), primary: true },
      { label: "Use our model", onClick: () => selectSource("model") },
    ];
    if (err.name === "NotAllowedError" || err.name === "SecurityError") {
      showStatus("Camera access is blocked. Click the camera icon in the address bar, choose Allow, then try again.", retry);
    } else if (err.name === "NotFoundError" || err.name === "OverconstrainedError") {
      showStatus("No camera was found on this device. Upload a photo or use our model instead.", retry.slice(1));
    } else if (err.name === "NotReadableError") {
      showStatus("Another app is using the camera. Close it, then try again.", retry);
    } else {
      showStatus("The camera couldn't start. Try again, or use a photo instead.", retry);
    }
  }
}

// Smooth the points a little between frames so makeup doesn't jitter (alpha ≈ 0.5)
function smooth(prev, next) {
  if (!prev || !next) return next;
  return next.map((p, i) => ({ x: prev[i].x * 0.5 + p.x * 0.5, y: prev[i].y * 0.5 + p.y * 0.5, z: p.z }));
}

let noFaceFrames = 0;
function cameraLoop() {
  if (source !== "camera" || !stream) return;
  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const found = landmarker.detectForVideo(video, performance.now()).faceLandmarks[0] || null;
    landmarks = smooth(landmarks, found);
    noFaceFrames = found ? 0 : noFaceFrames + 1; // only say "no face" after a short moment
    if (noFaceFrames > 15) showStatus(NO_FACE_CAMERA);
    else if (found && !statusBox.hidden) hideStatus();
    draw();
  }
  requestAnimationFrame(cameraLoop);
}

function stopCamera() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  video.srcObject = null;
  canvas.classList.remove("is-mirrored");
}

async function selectSource(next, { force = false } = {}) {
  if (!landmarker || (next === source && !force && sourceEl)) return;
  const id = ++switchId;
  source = next;
  document.querySelectorAll("[data-source]").forEach((t) => {
    const on = t.dataset.source === next;
    t.setAttribute("aria-selected", String(on));
    t.tabIndex = on ? 0 : -1;
  });
  stopCamera();
  changePhoto.hidden = true;
  landmarks = null;
  try {
    if (next === "model") await showModel(id);
    if (next === "upload") await showUpload(id);
    if (next === "camera") await showCamera(id);
  } catch (err) {
    console.error(err);
    if (id === switchId) showStatus("Something went wrong loading this face. Try again.");
  }
}

// =========================================================
// 4) Product picker: tab → real products → shades
// =========================================================
const shadeTitle = (line, shade) => `${shade.name || line.name}${shade.code ? ` (${shade.code})` : ""}${shade.undertone ? ` · ${shade.undertone}` : ""}`;

function buildTabs() {
  $("cats").innerHTML = `
    <div class="chips" role="group" aria-label="Where it goes">
      ${GROUPS.map((g) => `<button class="chip" type="button" data-cat="${g.id}" aria-pressed="false">${g.label}</button>`).join("")}
    </div>
    <button class="btn btn--small tryon__combo" type="button" id="lip-combo">Lip combo</button>`;
  $("cats").querySelectorAll("[data-cat]").forEach((chip) =>
    chip.addEventListener("click", () => selectGroup(chip.dataset.cat))
  );
  $("lip-combo").addEventListener("click", applyLipCombo);
}

function selectGroup(id) {
  group = id;
  document.querySelectorAll("[data-cat]").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.cat === id)));
  currentLineId = null;
  renderPicker();
}

function renderPicker() {
  const lines = tryable(group);
  const worn = (line) => look[slotOf(line)]?.lineId === line.id;
  if (!lines.some((l) => l.id === currentLineId)) currentLineId = (lines.find(worn) || lines[0]).id;

  productList.innerHTML = lines
    .map((l) => {
      const wornShade = worn(l) ? getShade(look[slotOf(l)].shadeId).shade : null;
      const count = l.shades.filter((s) => s.hex).length;
      return `
      <button class="tp" type="button" data-line="${l.id}" aria-pressed="${l.id === currentLineId}">
        <img src="${(wornShade || defaultShade(l)).image}" alt="" width="96" height="96" loading="lazy">
        <span class="tp__name">${l.name}</span>
        <span class="tp__meta">${l.finishLabel || MATERIALS[l.material].label} · ${count} ${count === 1 ? "shade" : "shades"}</span>
      </button>`;
    })
    .join("");
  const chosen = productList.querySelector('[aria-pressed="true"]');
  if (chosen) productList.scrollLeft = chosen.offsetLeft - productList.offsetLeft - 2;
  renderDots(getLine(currentLineId));
}

productList.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-line]");
  if (!btn) return;
  currentLineId = btn.dataset.line;
  productList.querySelectorAll("[data-line]").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
  renderDots(getLine(currentLineId));
});

function renderDots(line) {
  const slot = slotOf(line);
  const current = look[slot];
  const shades = line.shades.filter((s) => s.hex);
  dots.innerHTML = shades
    .map((s) => {
      const on = current?.shadeId === s.id;
      const title = shadeTitle(line, s);
      return `<button class="dot ${s.inStock ? "" : "is-soldout"}" type="button" data-shade="${s.id}" style="--dot:${s.hex}"
        aria-pressed="${on}" aria-label="${title}${s.inStock ? "" : ", sold out"}" title="${title}"></button>`;
    })
    .join("");
  const wearing = current && current.lineId === line.id ? getShade(current.shadeId).shade : null;
  shadeLabel.innerHTML = wearing
    ? `Wearing: <strong>${wearing.name || line.name}</strong>`
    : `Choose a shade to try it on (${shades.length})`;
  renderCard(line, wearing || shades[0], Boolean(wearing));
}

// The exact shade: photo, name, shade code, price, Add to bag
function renderCard(line, shade, isWorn) {
  shadeCard.innerHTML = `
    <img class="shade-card__img" src="${shade.image}" alt="${line.name}${shade.name ? ` in ${shade.name}` : ""}" width="112" height="112">
    <div class="shade-card__info">
      <p class="shade-card__line">${line.name} · ${line.finishLabel || MATERIALS[line.material].label}</p>
      ${shade.name ? `<p class="shade-card__shade">${shade.name}</p>` : ""}
      ${shade.code ? `<p class="shade-card__code">Shade code ${shade.code} ${undertoneTag(shade.undertone)}</p>` : ""}
      ${(() => { const h = undertoneHint(shade.undertone); return h ? `<p class="hint hint--${h.kind}">${h.text}</p>` : ""; })()}
      ${priceHTML(shade)}
      ${isWorn ? "" : `<p class="shade-card__hint">Showing the first shade. Choose a color to try it on.</p>`}
    </div>
    <div class="shade-card__actions">
      <button class="btn btn--primary" type="button" data-add-to-bag="${shade.id}" ${shade.inStock ? "" : "disabled"}>
        ${shade.inStock ? "Add to bag" : "Sold out"}
      </button>
      <a class="link-btn" href="${productUrl(line, shade)}">Product details</a>
    </div>`;
}

// Point at a dot to see that shade's name and code first
const previewShade = (e) => {
  const btn = e.target.closest?.("[data-shade]");
  if (!btn) return;
  const line = getLine(currentLineId);
  renderCard(line, line.shades.find((s) => s.id === btn.dataset.shade), look[slotOf(line)]?.shadeId === btn.dataset.shade);
};
const backToWorn = () => {
  const line = getLine(currentLineId);
  const w = look[slotOf(line)]?.lineId === line.id ? getShade(look[slotOf(line)].shadeId).shade : null;
  renderCard(line, w || line.shades.find((s) => s.hex), Boolean(w));
};
dots.addEventListener("mouseover", previewShade);
dots.addEventListener("focusin", previewShade);
dots.addEventListener("mouseleave", backToWorn);
dots.addEventListener("focusout", (e) => { if (!dots.contains(e.relatedTarget)) backToWorn(); });

function wear(line, shadeId, intensity) {
  const slot = slotOf(line);
  look[slot] = {
    lineId: line.id, shadeId,
    intensity: intensity ?? look[slot]?.intensity ?? MATERIALS[line.material].defaultIntensity ?? 1,
  };
}

// Click a shade to wear it (click it again to take it off)
dots.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-shade]");
  if (!btn) return;
  const line = getLine(currentLineId), slot = slotOf(line);
  if (look[slot]?.shadeId === btn.dataset.shade) delete look[slot];
  else wear(line, btn.dataset.shade);
  renderPicker();
  renderWearing();
  scheduleDraw();
});

// Lip combo: liner, then a matte lipstick, then a touch of gloss
function applyLipCombo() {
  const picks = [
    ["kiss-couture-waterproof-liner", "kiss-couture-waterproof-liner-no-004", 1],
    ["matte-couture-liquid-lipstick", "matte-couture-liquid-lipstick-chiffon", 1],
    ["3d-plumping-intense-lipgloss", "3d-plumping-intense-lipgloss-gloss-me", 0.6],
  ];
  for (const [lineId, shadeId, intensity] of picks) {
    const line = getLine(lineId);
    if (line?.shades.some((s) => s.id === shadeId)) wear(line, shadeId, intensity);
  }
  selectGroup("lips");
  renderWearing();
  scheduleDraw();
}

// =========================================================
// 5) "Now wearing": photo, name, shade code, strength, Add to bag
// =========================================================
function renderWearing() {
  const slots = SLOT_ORDER.filter((s) => look[s]);
  $("wearing-empty").hidden = slots.length > 0;
  $("wearing-foot").hidden = slots.length === 0;

  $("wearing").innerHTML = slots
    .map((slot) => {
      const { line, shade } = getShade(look[slot].shadeId);
      const pct = Math.round(look[slot].intensity * 100);
      return `
      <li class="wearing__item">
        <a class="wearing__photo" href="${productUrl(line, shade)}" tabindex="-1" aria-hidden="true">
          <img src="${shade.image}" alt="" width="64" height="64" loading="lazy">
        </a>
        <div class="wearing__info">
          <p class="wearing__cat">${SLOT_LABEL[slot]} · ${MATERIALS[line.material].label}</p>
          <p class="wearing__name">${line.name}</p>
          <p class="wearing__shade">
            <span class="dot dot--mini" style="--dot:${shade.hex}" aria-hidden="true"></span>
            ${shade.name || ""}${shade.code ? ` <span class="wearing__code">${shade.code}</span>` : ""}
          </p>
          <label class="wearing__slider">
            <span>Strength</span>
            <input type="range" min="10" max="100" step="5" value="${pct}" data-intensity="${slot}" aria-label="${SLOT_LABEL[slot]} strength">
          </label>
        </div>
        <div class="wearing__side">
          <span class="wearing__price">${formatPrice(shade.price)}</span>
          <button class="btn btn--small" type="button" data-add-to-bag="${shade.id}" ${shade.inStock ? "" : "disabled"}>
            ${shade.inStock ? "Add to bag" : "Sold out"}
          </button>
          <button class="link-btn" type="button" data-remove="${slot}">Remove</button>
        </div>
      </li>`;
    })
    .join("");

  $("look-total").textContent = formatPrice(
    slots.reduce((sum, slot) => sum + getShade(look[slot].shadeId).shade.price, 0)
  );
}

$("wearing").addEventListener("input", (e) => {
  const slot = e.target.dataset.intensity;
  if (!slot) return;
  look[slot].intensity = Number(e.target.value) / 100;
  scheduleDraw({ quick: true });
});

$("wearing").addEventListener("click", (e) => {
  const slot = e.target.closest("[data-remove]")?.dataset.remove;
  if (!slot) return;
  delete look[slot];
  renderWearing();
  renderPicker();
  scheduleDraw();
});

// Add every product of the look (the sign-in window opens first if needed)
$("add-look").addEventListener("click", () => {
  const entries = SLOT_ORDER.filter((s) => look[s]).map((s) => ({ id: look[s].shadeId, qty: 1 }));
  if (!entries.length) return;
  requestAdd(entries, `your look (${entries.length} ${entries.length === 1 ? "product" : "products"})`);
});

// =========================================================
// 6) Before / After: hold the button (mouse, touch or keyboard)
// =========================================================
function setBefore(on) {
  if (before === on) return;
  before = on;
  compareBtn.setAttribute("aria-pressed", String(on));
  compareBtn.textContent = on ? "Showing before" : "Hold to see before";
  scheduleDraw();
  if (source === "camera") draw();
}
compareBtn.addEventListener("pointerdown", (e) => { compareBtn.setPointerCapture(e.pointerId); setBefore(true); });
compareBtn.addEventListener("pointerup", () => setBefore(false));
compareBtn.addEventListener("pointercancel", () => setBefore(false));
compareBtn.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); setBefore(true); } });
compareBtn.addEventListener("keyup", () => setBefore(false));
compareBtn.addEventListener("blur", () => setBefore(false));

// =========================================================
// 7) Source tabs (click + arrow keys)
// =========================================================
const sourceTabs = [...document.querySelectorAll("[data-source]")];
sourceTabs.forEach((tab, i) => {
  const choose = (t) => {
    if (t.dataset.source === "upload" && !uploadedPhoto) fileInput.click();
    selectSource(t.dataset.source, { force: t.dataset.source === "camera" && !stream });
  };
  tab.addEventListener("click", () => choose(tab));
  tab.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = sourceTabs[(i + (e.key === "ArrowRight" ? 1 : -1) + sourceTabs.length) % sourceTabs.length];
    next.focus();
    choose(next);
  });
});

// =========================================================
// 8) Start
// =========================================================
async function start() {
  buildTabs();
  // Coming from a product page: try-on.html?product=…&shade=…
  const params = new URLSearchParams(location.search);
  const line = getLine(params.get("product"));
  if (line && MATERIALS[line.material]) {
    const shade = line.shades.find((s) => s.id === params.get("shade") && s.hex) || line.shades.find((s) => s.hex);
    if (shade) { wear(line, shade.id); group = line.tryOn; currentLineId = line.id; }
  }
  // Picks sent from Find my shade
  try {
    const sent = JSON.parse(sessionStorage.getItem("neverti.tryLook") || "[]");
    sessionStorage.removeItem("neverti.tryLook");
    for (const id of sent) {
      const found = getShade(id);
      if (found && MATERIALS[found.line.material] && found.shade.hex) wear(found.line, id);
    }
  } catch { /* ignore */ }
  selectGroup(group);
  renderWearing();
  onSkinProfile(() => currentLineId && renderDots(getLine(currentLineId)));

  showStatus("Loading the try-on…");
  try {
    await loadLandmarker();
  } catch (err) {
    console.error(err);
    showStatus("The try-on couldn't load. Check your internet connection, then reload the page.", [
      { label: "Reload", onClick: () => location.reload(), primary: true },
    ]);
    return;
  }
  await selectSource("model", { force: true });
}

start();
