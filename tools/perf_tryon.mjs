// =========================================================
// tools/perf_tryon.mjs — how long does one frame of makeup take?
// Renders a full look (11 products) at the live-camera size and at photo size.
// Run: node tools/perf_tryon.mjs
// =========================================================

import { startServer, launch, openPage } from "./check_pages.mjs";

const server = await startServer();
const browser = await launch();
const { page, context } = await openPage(browser, "index.html", { width: 1200, height: 800 });

const result = await page.evaluate(async () => {
  const { loadFaceLandmarker } = await import("/js/tryon/face.js");
  const { createRenderer } = await import("/js/tryon/makeup.js");
  const { LINES } = await import("/js/products.js");
  const img = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = "/assets/images/model.png"; });
  const lm = await loadFaceLandmarker();
  const landmarks = lm.detect(img).faceLandmarks[0];
  const canvas = document.createElement("canvas");
  const renderer = createRenderer(canvas);

  const pick = (material) => {
    const line = LINES.find((l) => l.material === material);
    const shade = line.shades.find((s) => s.hex);
    return { material, hex: shade.hex, shadeName: shade.name || "", lineName: line.name, intensity: 1 };
  };
  const full = ["foundation-soft-matte", "concealer-serum", "powder-pressed", "contour", "cream-blush", "highlighter",
    "brow-pomade", "kohl-liner", "mascara", "lip-liner", "matte-liquid-lipstick", "plumping-gloss"].map(pick);
  const lipsOnly = [pick("matte-liquid-lipstick")];
  const eyes = [pick("kohl-liner"), pick("mascara")];

  const time = (look, maxSide) => {
    renderer.render(img, landmarks, look, { maxSide, live: maxSide === 480 }); // warm up (the second render onward uses saved masks)
    const runs = [];
    for (let i = 0; i < 5; i++) {
      const t = performance.now();
      renderer.render(img, landmarks, look, { maxSide, live: maxSide === 480 });
      runs.push(performance.now() - t);
    }
    runs.sort((a, b) => a - b);
    return Math.round(runs[2]);
  };
  renderer.render(img, landmarks, full, { maxSide: 2048 });
  const slow = renderer.timings.map(([m, ms]) => m + " " + ms).join(", ");
  return {
    slowest_photo: slow,
    camera_lips: time(lipsOnly, 480), camera_eyes: time(eyes, 480), camera_fullLook: time(full, 480),
    photo_lips: time(lipsOnly, 2048), photo_fullLook: time(full, 2048), photo_preview900: time(full, 900),
  };
});
console.log("milliseconds per frame (median of 5):");
console.log(result);
await context.close();
await browser.close();
server.close();
