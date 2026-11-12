// =========================================================
// NEVERTI — tryon/lab.js
// The materials lab: every material on our model, before and after.
// Also the table of shade colors, where a color can be corrected by hand.
// =========================================================

import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";
import { LINES, IMAGES } from "../products.js";
import { MATERIALS, SLOT_LABEL } from "./materials.js";
import { createRenderer } from "./makeup.js";
import { saveHexOverride, clearHexOverride, hexOverrides } from "../products.js";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const $ = (id) => document.getElementById(id);
const grid = $("grid");
const progress = $("progress");
const debugBox = $("debug");
if (new URLSearchParams(location.search).get("debug")) debugBox.checked = true;

// Landmark groups used to crop each tile around the area the product goes on
const AREA = {
  lip: [61, 291, 0, 17], lipline: [61, 291, 0, 17],
  skin: [234, 454, 105, 334, 17],
  concealer: [33, 263, 145, 374, 50, 280],
  blush: [50, 280, 159, 386, 17], contour: [234, 454, 159, 386, 17], highlighter: [234, 454, 168, 17, 105, 334],
  liner: [33, 133, 362, 263, 55, 285, 145, 374], mascara: [33, 133, 362, 263, 55, 285, 145, 374],
  brows: [46, 55, 276, 285, 105, 334, 70, 300],
};
const TILE_W = 380;

// A good-looking shade to start each tile with
const PREFERRED = {
  "matte-liquid-lipstick": "Tango Red", "plumping-gloss": "Kissable Lips", "lip-oil": "Raspberry Kiss",
  "shimmer-gloss": "Glossy Vibe", "liquid-blush": "Orange In Fire", "cream-blush": "Adrenaline",
  "powder-blush": "Peony Pink", "highlighter": "Rosy Glow", "tinted-balm": "Cheerful Glow",
  "lip-tint": "No. 004", "satin-lipstick": "Lady In Red", "shine-lipstick": "Tempting Red",
  "matte-lipstick": "Be Nude", "kohl-liner": "No. 001", "brow-pomade": "Auburn", "brow-pen": "No. 002",
  "brow-mascara": "Medium Brown", "lip-liner": "No. 004", "concealer-serum": "Warm Beige",
  "foundation-soft-matte": "No. 004", "foundation-glow": "Ivory", "bb-cream": "Classic Ivory", "powder-pressed": "Light Cream", "powder-loose": "No. R01",
};

// ---------- Face ----------
const modelImg = await new Promise((ok, fail) => {
  const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = IMAGES.model;
});
const vision = await FilesetResolver.forVisionTasks(WASM_URL);
let landmarker;
try {
  landmarker = await FaceLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" }, runningMode: "IMAGE", numFaces: 1 });
} catch {
  landmarker = await FaceLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" }, runningMode: "IMAGE", numFaces: 1 });
}
const landmarks = landmarker.detect(modelImg).faceLandmarks[0];
if (!landmarks) { progress.textContent = "No face found in the model photo."; throw new Error("no face"); }

const work = document.createElement("canvas");
const renderer = createRenderer(work);

// A crop rectangle around some landmarks (pixels in the model photo)
function cropFor(kind) {
  const pts = AREA[kind].map((i) => ({ x: landmarks[i].x * modelImg.naturalWidth, y: landmarks[i].y * modelImg.naturalHeight }));
  let x0 = Math.min(...pts.map((p) => p.x)), x1 = Math.max(...pts.map((p) => p.x));
  let y0 = Math.min(...pts.map((p) => p.y)), y1 = Math.max(...pts.map((p) => p.y));
  const pad = Math.max(x1 - x0, 1) * ({ skin: 0.1, lip: 0.12, lipline: 0.12, blush: 0.28 }[kind] ?? 0.22);
  x0 -= pad; x1 += pad; y0 -= pad * 0.7; y1 += pad * 0.7;
  // 4:3 box around the center
  let w = x1 - x0, h = y1 - y0;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  if (w / h > 4 / 3) h = w * 3 / 4; else w = h * 4 / 3;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

// ---------- Side by side: one row per group, the same shade, only the finish changes ----------
const COMPARE = [
  { title: "Lip finishes", kind: "lip", hex: "#B6596B", note: "Chiffon rose, same for all",
    materials: ["matte-liquid-lipstick", "matte-lipstick", "satin-lipstick", "shine-lipstick", "lip-tint", "tinted-balm", "plumping-gloss", "shimmer-gloss", "lip-oil"] },
  { title: "Blush finishes", kind: "blush", hex: "#D77669", note: "The same coral, for all",
    materials: ["powder-blush", "powder-cream-blush", "cream-blush", "liquid-blush", "glowy-blush"] },
  { title: "Face finishes", kind: "skin", hex: "#EDC4A6", note: "The same skin tone, for all",
    materials: ["foundation-soft-matte", "foundation-glow", "bb-cream", "powder-pressed", "powder-loose"] },
  { title: "Eyeliner types", kind: "liner", hex: "#1A1A1B", note: "Black, for all",
    materials: ["kohl-liner", "liquid-liner", "matte-liquid-liner", "gel-liner"] },
  { title: "Brow types", kind: "brows", hex: "#8A5A40", note: "The same brown, for all",
    materials: ["brow-pomade", "brow-mascara", "brow-pen", "brow-wax"] },
];
const compareBox = $("compare");
for (const row of COMPARE) {
  const section = document.createElement("div");
  section.className = "compare-row";
  section.innerHTML = `<h3>${row.title} <small>${row.note}</small></h3>
    <div class="compare-row__cells">
      <figure><canvas></canvas><figcaption>Before</figcaption></figure>
      ${row.materials.map((id) => `<figure data-material="${id}"><canvas></canvas><figcaption>${MATERIALS[id].label}</figcaption></figure>`).join("")}
    </div>`;
  compareBox.append(section);
  row.el = section;
}
function renderCompare(row) {
  const debug = debugBox.checked;
  const cells = row.el.querySelectorAll("canvas");
  renderer.render(modelImg, landmarks, [], { before: true });
  drawCrop(cells[0], row.kind);
  row.materials.forEach((id, i) => {
    renderer.render(modelImg, landmarks, [{ material: id, hex: row.hex, shadeName: "", lineName: "", intensity: 1 }], { debug });
    drawCrop(cells[i + 1], row.kind);
  });
}

// ---------- One tile per material ----------
const tiles = [];
const firstLine = (id) => LINES.find((l) => l.material === id && l.shades.some((s) => s.hex));

for (const [id, M] of Object.entries(MATERIALS)) {
  const line = firstLine(id);
  if (!line) continue;
  const shades = line.shades.filter((s) => s.hex);
  const pref = shades.find((s) => s.name === PREFERRED[id]) || shades[Math.floor(shades.length / 2)];
  const tile = document.createElement("article");
  tile.className = "lab-tile";
  tile.innerHTML = `
    <header class="lab-tile__head">
      <h2>${M.label}</h2>
      <p>${line.name} · ${SLOT_LABEL[M.slot]}</p>
    </header>
    <div class="lab-tile__views">
      <figure><canvas></canvas><figcaption>Before</figcaption></figure>
      <figure><canvas></canvas><figcaption>After</figcaption></figure>
    </div>
    <div class="lab-tile__controls">
      <label>Shade
        <select>${shades.map((s) => `<option value="${s.id}" ${s.id === pref.id ? "selected" : ""}>${s.name || line.name}</option>`).join("")}</select>
      </label>
      <label>Strength <input type="range" min="10" max="100" value="100"></label>
    </div>`;
  grid.append(tile);
  tiles.push({ id, M, line, tile, shades, kind: M.kind === "skin" ? "skin" : M.kind });
}

const [beforeC, afterC] = [0, 1];
function drawCrop(target, kind) {
  const r = cropFor(kind);
  const scale = work.width / modelImg.naturalWidth;
  target.width = TILE_W; target.height = Math.round(TILE_W * r.h / r.w);
  target.getContext("2d").drawImage(work, r.x * scale, r.y * scale, r.w * scale, r.h * scale, 0, 0, target.width, target.height);
}

function renderTile(t) {
  const canvases = t.tile.querySelectorAll("canvas");
  const select = t.tile.querySelector("select");
  const slider = t.tile.querySelector("input");
  const shade = t.shades.find((s) => s.id === select.value);
  const debug = debugBox.checked;
  renderer.render(modelImg, landmarks, [], { before: true });
  drawCrop(canvases[beforeC], t.kind);
  renderer.render(modelImg, landmarks, [{
    material: t.id, hex: shade.hex, shadeName: shade.name || "", lineName: t.line.name, intensity: Number(slider.value) / 100,
  }], { debug });
  drawCrop(canvases[afterC], t.kind);
}

async function renderAll() {
  for (const row of COMPARE) {
    progress.textContent = "Drawing " + row.title.toLowerCase() + "…";
    renderCompare(row);
    await new Promise((r) => setTimeout(r, 0));
  }
  for (let i = 0; i < tiles.length; i++) {
    progress.textContent = `Drawing ${i + 1} of ${tiles.length}…`;
    renderTile(tiles[i]);
    await new Promise((r) => setTimeout(r, 0)); // let the page breathe
  }
  progress.textContent = `${tiles.length} materials`;
  document.body.dataset.ready = "true";
}

grid.addEventListener("input", (e) => {
  const tile = e.target.closest(".lab-tile");
  if (tile) renderTile(tiles.find((t) => t.tile === tile));
});
debugBox.addEventListener("change", renderAll);

// ---------- Shade colors table (hand corrections) ----------
function renderColors() {
  const overrides = hexOverrides();
  const lines = LINES.filter((l) => l.material && l.shades.some((s) => s.hex));
  $("colors").innerHTML = lines.map((l) => `
    <details class="colors__line">
      <summary>${l.name} <span>${l.shades.filter((s) => s.hex).length} shades</span></summary>
      <ul>${l.shades.filter((s) => s.hex).map((s) => `
        <li>
          <img src="${s.image}" alt="" width="48" height="48" loading="lazy">
          <span class="colors__name">${s.name || l.name}${s.code ? ` <small>${s.code}</small>` : ""}</span>
          <input type="color" value="${s.hex.toLowerCase()}" data-shade="${s.id}" aria-label="Color of ${s.name || l.name}">
          <code>${s.hex}</code>
          <small>${overrides[s.id] ? "changed by hand" : s.hexSource === "swatch" ? "from the swatch" : ""}</small>
          ${overrides[s.id] ? `<button class="link-btn" type="button" data-reset="${s.id}">Reset</button>` : ""}
        </li>`).join("")}
      </ul>
    </details>`).join("");
}
$("colors").addEventListener("change", (e) => {
  const input = e.target.closest("[data-shade]");
  if (!input) return;
  saveHexOverride(input.dataset.shade, input.value.toUpperCase());
  location.reload(); // simplest way to refresh every tile with the new color
});
$("colors").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-reset]");
  if (!btn) return;
  clearHexOverride(btn.dataset.reset);
  location.reload();
});

renderColors();
await renderAll();
