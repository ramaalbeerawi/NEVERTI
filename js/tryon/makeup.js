// =========================================================
// NEVERTI — tryon/makeup.js
// The makeup engine. Draws Neverti products on a face using the 478 points
// MediaPipe finds. Every product has a MATERIAL (materials.js), and each
// material is rendered pixel by pixel on a copy of the photo:
//
//   1. MASK    a polygon from the landmarks, softened (feathered).
//   2. COLORIZE  the shade color replaces the pixel's color but keeps the
//              pixel's own light and dark (pores, freckles, lip creases).
//              out = shade × (pixel luma / area mean luma) ^ textureKeep
//   3. HIGHLIGHTS  kept separate from color: matte products flatten
//              them, glossy products add wet speculars.
//   4. MIX     result = original + (out − original) × opacity × mask
//
// Nothing is ever painted as a flat fill. Everything runs on the visitor's
// device.
// =========================================================

import { SLOT_ORDER, materialFor } from "./materials.js";

// ---------- Face point numbers (MediaPipe face mesh) ----------
const LIPS_OUTER = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
const LIPS_INNER = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
// The same lips, as lines from the left corner to the right corner
const OUT_UPPER = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291];
const OUT_LOWER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291];
const IN_UPPER = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
const IN_LOWER = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308];

const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377,
  152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];

// Each eye, from the inner corner to the outer corner
const EYES = [
  { upper: [133, 173, 157, 158, 159, 160, 161, 246, 33], lower: [133, 155, 154, 153, 145, 144, 163, 7, 33], brow: 105 },
  { upper: [362, 398, 384, 385, 386, 387, 388, 466, 263], lower: [362, 382, 381, 380, 374, 373, 390, 249, 263], brow: 334 },
];
// Eyebrows, from the inner end to the tail
const BROWS = [
  { upper: [107, 66, 105, 63, 70], lower: [55, 65, 52, 53, 46] },
  { upper: [336, 296, 334, 293, 300], lower: [285, 295, 282, 283, 276] },
];
const CHEEKS = [
  { apple: [50, 101, 118], ear: 234, jaw: [132, 150] },
  { apple: [280, 330, 347], ear: 454, jaw: [361, 379] },
];

// ---------- Small helpers ----------
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a, k) => ({ x: a.x * k, y: a.y * k });
const len = (a) => Math.hypot(a.x, a.y);
const dist = (a, b) => len(sub(a, b));
const norm = (a) => mul(a, 1 / (len(a) || 1));
const dot = (a, b) => a.x * b.x + a.y * b.y;
const mid = (a, b) => mul(add(a, b), 0.5);
const avg = (list) => mul(list.reduce(add, { x: 0, y: 0 }), 1 / list.length);
const lerp = (a, b, t) => add(a, mul(sub(b, a), t));
const perp = (a) => ({ x: a.y, y: -a.x });
// A point along a list of points, t from 0 to 1
function along(points, t) {
  const f = clamp(t, 0, 1) * (points.length - 1);
  const i = Math.min(points.length - 2, Math.floor(f));
  return lerp(points[i], points[i + 1], f - i);
}
function rgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const lumaOf = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

// Seeded random numbers: the same face always gets the same lash / hair / sparkle pattern
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(x, y) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// An oval as a polygon
function ellipsePoly(cx, cy, rx, ry, angle = 0, n = 36) {
  const c = Math.cos(angle), s = Math.sin(angle), out = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = rx * Math.cos(t), y = ry * Math.sin(t);
    out.push({ x: cx + x * c - y * s, y: cy + x * s + y * c });
  }
  return out;
}
// A soft oval stretched between two points
function ovalAlong(a, b, thick, n = 28) {
  const c = mid(a, b), d = sub(b, a);
  return ellipsePoly(c.x, c.y, len(d) / 2, thick / 2, Math.atan2(d.y, d.x), n);
}
const inflate = (poly, k) => {
  const c = avg(poly);
  return poly.map((p) => add(c, mul(sub(p, c), k)));
};

// ---------- Blur (works the same in every browser) ----------
function blurPass(src, dst, w, h, r, horizontal) {
  const n = horizontal ? w : h;
  const lines = horizontal ? h : w;
  const stride = horizontal ? 1 : w;
  const lineStride = horizontal ? w : 1;
  const d = 2 * r + 1;
  for (let l = 0; l < lines; l++) {
    const base = l * lineStride;
    let sum = 0;
    for (let i = -r; i <= r; i++) sum += src[base + clamp(i, 0, n - 1) * stride];
    for (let i = 0; i < n; i++) {
      dst[base + i * stride] = sum / d;
      sum += src[base + Math.min(n - 1, i + r + 1) * stride] - src[base + Math.max(0, i - r) * stride];
    }
  }
}
function boxBlur(a, w, h, r, passes = 3) {
  if (r < 1) return;
  const t = new Float32Array(a.length);
  for (let p = 0; p < passes; p++) {
    blurPass(a, t, w, h, r, true);
    blurPass(t, a, w, h, r, false);
  }
}

// "Color" blend: take the hue and saturation of (c0,c1,c2) with luma L. Result in out[].
const out3 = [0, 0, 0];
function setLum(c0, c1, c2, L) {
  const d = L - lumaOf(c0, c1, c2);
  let r = c0 + d, g = c1 + d, b = c2 + d;
  const n = Math.min(r, g, b), x = Math.max(r, g, b);
  if (n < 0) { const s = L / (L - n + 1e-6); r = L + (r - L) * s; g = L + (g - L) * s; b = L + (b - L) * s; }
  if (x > 255) { const s = (255 - L) / (x - L + 1e-6); r = L + (r - L) * s; g = L + (g - L) * s; b = L + (b - L) * s; }
  out3[0] = r; out3[1] = g; out3[2] = b;
}

// =========================================================
// The renderer
// =========================================================
export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const mk = () => {
    const c = document.createElement("canvas");
    return [c, c.getContext("2d", { willReadFrequently: true })];
  };
  const [scratch, sctx] = mk(); // masks and highlight shapes
  const [big, bctx] = mk();     // lash / hair strokes, drawn at 2× and shrunk
  const [small, smctx] = mk();

  let W = 0, H = 0, work = null, g = null, sc = 1;
  const timings = []; // [material, ms] for the last render (for speed checks)
  // Masks only depend on the face points and the product's shape, not on the color or
  // strength. For a still photo we keep them, so moving a slider doesn't rebuild them.
  const cache = new Map();
  let cacheKey = null, live = false;

  // ---------- Geometry from the landmarks ----------
  function geometry(lm) {
    const P = (i) => ({ x: lm[i].x * W, y: lm[i].y * H });
    const Ps = (ids) => ids.map(P);
    const geo = { P, Ps };
    geo.faceW = dist(P(234), P(454));
    geo.faceH = dist(P(10), P(152));
    geo.center = avg([P(234), P(454), P(10), P(152)]);
    geo.oval = Ps(FACE_OVAL);
    geo.lipsOuter = Ps(LIPS_OUTER);
    geo.lipsInner = Ps(LIPS_INNER);
    const outU = Ps(OUT_UPPER), outL = Ps(OUT_LOWER), inU = Ps(IN_UPPER), inL = Ps(IN_LOWER);
    geo.upperCenter = outU.map((p, i) => mid(p, inU[i]));
    geo.lowerCenter = outL.map((p, i) => mid(p, inL[i]));
    geo.mouthW = dist(P(61), P(291));
    geo.mouthC = avg(geo.lipsOuter);
    geo.lowerH = dist(P(17), P(14));
    geo.upperH = dist(P(0), P(13));

    // Eyes
    geo.eyes = EYES.map((e) => {
      const upper = Ps(e.upper), lower = Ps(e.lower);
      const inner = upper[0], outer = upper[upper.length - 1];
      const width = dist(inner, outer);
      const axis = norm(sub(outer, inner));
      let up = perp(axis);
      if (dot(up, sub(P(e.brow), avg(upper))) < 0) up = mul(up, -1);
      const open = dist(upper[4], lower[4]) / width;
      // Under-eye crescent: the lower lid pushed down, deepest toward the inner side
      const top = lower.map((p) => add(p, mul(up, -width * 0.07)));
      const bottom = lower.map((p, i) => {
        const t = i / (lower.length - 1);
        return add(p, mul(up, -width * (0.08 + 0.34 * Math.sin(Math.PI * Math.pow(t, 0.8)))));
      });
      return { upper, lower, inner, outer, width, axis, up, open, closed: open < 0.14,
        under: [...top, ...bottom.reverse()] };
    });

    // Brows
    geo.brows = BROWS.map((b) => {
      const upper = Ps(b.upper), lower = Ps(b.lower);
      const poly = inflate([...upper, ...lower.slice().reverse()], 1.07);
      return { upper, lower, poly, height: dist(upper[2], lower[2]) };
    });

    // Cheeks, contour and highlight shapes
    geo.cheeks = CHEEKS.map((c, i) => {
      const apple = avg(Ps(c.apple));
      const ear = P(c.ear);
      const toEar = norm(sub(ear, apple));
      const center = add(add(apple, mul(toEar, geo.faceW * 0.05)), { x: 0, y: geo.faceW * 0.03 });
      const angle = Math.atan2(toEar.y, toEar.x) - Math.sign(toEar.x) * 0.5;
      const eye = geo.eyes[i];
      const pupilX = (eye.inner.x + eye.outer.x) / 2;
      const target = { x: pupilX, y: apple.y + geo.faceW * 0.075 };
      return {
        apple, ear, center, angle, toEar,
        contour: ovalAlong(lerp(ear, target, 0.2), lerp(ear, target, 0.85), geo.faceW * 0.085),
        jaw: ovalAlong(P(c.jaw[0]), P(c.jaw[1]), geo.faceW * 0.055),
      };
    });
    geo.highlightShapes = [
      ...geo.eyes.map((e) => {
        const down = mul(e.up, -1);
        const a = add(e.outer, add(mul(down, e.width * 0.5), mul(e.axis, -e.width * 0.3)));
        const b = add(e.outer, add(mul(down, e.width * 0.85), mul(e.axis, e.width * 0.55)));
        return ovalAlong(a, b, e.width * 0.26);
      }),
      ovalAlong(P(168), P(5), geo.faceW * 0.035),
      ellipsePoly(...Object.values(add(P(0), mul(sub(P(0), P(13)), 0.45))), geo.faceW * 0.02, geo.faceW * 0.014, 0, 16),
      ...geo.eyes.map((e) => ellipsePoly(e.inner.x, e.inner.y + e.width * 0.06, e.width * 0.12, e.width * 0.07, 0, 16)),
    ];
    geo.glowShapes = [
      geo.highlightShapes[0], geo.highlightShapes[1], geo.highlightShapes[2],
      ellipsePoly(P(151).x, P(151).y, geo.faceW * 0.14, geo.faceW * 0.07, 0, 24),
    ];
    return geo;
  }

  // Which side the light comes from: −1 (left of the image) … +1 (right)
  function lightDirection() {
    let left = 0, right = 0, nl = 0, nr = 0;
    const { center, faceW, faceH } = g;
    const step = Math.max(4, Math.round(faceW / 60));
    for (let y = center.y - faceH * 0.5; y < center.y + faceH * 0.5; y += step) {
      for (let x = center.x - faceW * 0.45; x < center.x + faceW * 0.45; x += step) {
        const dx = (x - center.x) / (faceW * 0.42), dy = (y - center.y) / (faceH * 0.5);
        if (dx * dx + dy * dy > 1 || x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = ((y | 0) * W + (x | 0)) << 2;
        const l = lumaOf(work[i], work[i + 1], work[i + 2]);
        if (x < center.x) { left += l; nl++; } else { right += l; nr++; }
      }
    }
    if (!nl || !nr) return 0;
    const a = left / nl, b = right / nr;
    return clamp((b - a) / (a + b), -0.3, 0.3) / 0.3;
  }

  // ---------- Masks ----------
  function polyPath(c, pts, smooth) {
    const n = pts.length;
    if (!smooth) {
      c.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < n; i++) c.lineTo(pts[i].x, pts[i].y);
      c.closePath();
      return;
    }
    const m = (i) => mid(pts[i % n], pts[(i + 1) % n]);
    const s = m(n - 1);
    c.moveTo(s.x, s.y);
    for (let i = 0; i < n; i++) {
      const e = m(i);
      c.quadraticCurveTo(pts[i].x, pts[i].y, e.x, e.y);
    }
    c.closePath();
  }

  function boundsOf(polys, pad) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of polys) for (const q of p) {
      if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x;
      if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y;
    }
    x0 = clamp(Math.floor(x0 - pad), 0, W); y0 = clamp(Math.floor(y0 - pad), 0, H);
    x1 = clamp(Math.ceil(x1 + pad), 0, W); y1 = clamp(Math.ceil(y1 + pad), 0, H);
    return { x0, y0, w: x1 - x0, h: y1 - y0 };
  }

  // A feathered mask from polygons (holes work: overlapping shapes cut each other out)
  function makeMask(polys, feather, opts = {}) {
    const key = opts.key && !live ? opts.key + "|" + feather.toFixed(2) : null;
    if (key && cache.has(key)) return cache.get(key);
    const mask = buildMask(polys, feather, opts);
    if (key) cache.set(key, mask);
    return mask;
  }
  function buildMask(polys, feather, { smooth = false, normalize = false } = {}) {
    const b = boundsOf(polys, Math.ceil(feather * 1.6) + 4);
    if (b.w < 2 || b.h < 2) return null;
    scratch.width = b.w; scratch.height = b.h;
    sctx.setTransform(1, 0, 0, 1, -b.x0, -b.y0);
    sctx.fillStyle = "#fff";
    sctx.beginPath();
    for (const p of polys) polyPath(sctx, p, smooth);
    sctx.fill("evenodd");
    const d = sctx.getImageData(0, 0, b.w, b.h).data;
    const a = new Float32Array(b.w * b.h);
    for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] / 255;
    const r = Math.round(feather * 0.45);
    if (r >= 1) boxBlur(a, b.w, b.h, r, 3);
    else if (feather >= 0.5) boxBlur(a, b.w, b.h, 1, 1); // just a soft antialiased edge
    if (normalize) {
      let max = 0;
      for (let i = 0; i < a.length; i++) if (a[i] > max) max = a[i];
      if (max > 0) for (let i = 0; i < a.length; i++) a[i] /= max;
    }
    return { ...b, a };
  }

  // Run fn for every covered pixel: (workIndex, maskValue, x, y, maskIndex)
  function forMask(mask, fn) {
    for (let y = 0; y < mask.h; y++) {
      const row = y * mask.w;
      for (let x = 0; x < mask.w; x++) {
        const a = mask.a[row + x];
        if (a > 0.004) {
          const wx = mask.x0 + x, wy = mask.y0 + y;
          fn((wy * W + wx) << 2, a, wx, wy, row + x);
        }
      }
    }
  }

  function meanLuma(mask, minA = 0.5) {
    let sum = 0, n = 0;
    forMask(mask, (i, a) => { if (a >= minA) { sum += lumaOf(work[i], work[i + 1], work[i + 2]); n++; } });
    return n ? sum / n : 128;
  }
  const lumaAt = (x, y) => {
    x = clamp(Math.round(x), 0, W - 1); y = clamp(Math.round(y), 0, H - 1);
    const i = (y * W + x) << 2;
    return lumaOf(work[i], work[i + 1], work[i + 2]);
  };

  // A stroke layer: draw lashes or hairs at 2× size and shrink for soft, natural edges
  function strokeLayer(polys, pad, draw) {
    const b = boundsOf(polys, pad);
    if (b.w < 2 || b.h < 2) return null;
    const S = 2;
    big.width = b.w * S; big.height = b.h * S;
    bctx.setTransform(S, 0, 0, S, -b.x0 * S, -b.y0 * S);
    bctx.lineCap = "round"; bctx.lineJoin = "round";
    draw(bctx);
    small.width = b.w; small.height = b.h;
    smctx.imageSmoothingEnabled = true; smctx.imageSmoothingQuality = "high";
    smctx.drawImage(big, 0, 0, b.w, b.h);
    const d = smctx.getImageData(0, 0, b.w, b.h).data;
    const a = new Float32Array(b.w * b.h);
    for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] / 255;
    return { ...b, a };
  }

  // Blend one color into the photo through a mask (shared by liners, lashes, strokes)
  function paintColor(mask, C, amount, { keep = 0.1 } = {}) {
    forMask(mask, (i, a) => {
      const m = clamp(a * amount, 0, 1);
      for (let c = 0; c < 3; c++) {
        const o = work[i + c];
        const col = C[c] * (1 - keep) + o * C[c] / 255 * keep;
        work[i + c] = o + (col - o) * m;
      }
    });
  }

  // =======================================================
  // A. LIPS
  // =======================================================
  // Soft specular shapes (a wet band on the lower lip, peaks on the upper lip)
  function highlightMap(mask, M, k) {
    const shift = g.light * g.mouthW * 0.04;
    const thick = g.lowerH * 0.5;
    const full = M.shape === "full" || M.shape === "pearl";
    // Draw white shapes on a layer the size of the mask, blur them, scale to 0..1
    const layer = (draw, blurR) => {
      scratch.width = mask.w; scratch.height = mask.h;
      sctx.setTransform(1, 0, 0, 1, -mask.x0, -mask.y0);
      sctx.fillStyle = "#fff";
      draw();
      sctx.globalAlpha = 1;
      const d = sctx.getImageData(0, 0, mask.w, mask.h).data;
      const a = new Float32Array(mask.w * mask.h);
      let max = 0;
      for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] / 255;
      boxBlur(a, mask.w, mask.h, blurR, 2);
      for (let i = 0; i < a.length; i++) if (a[i] > max) max = a[i];
      if (max > 0) for (let i = 0; i < a.length; i++) a[i] /= max;
      return a;
    };
    const blob = (p, r, alpha) => {
      sctx.globalAlpha = alpha;
      sctx.beginPath(); sctx.arc(p.x + shift, p.y, r, 0, Math.PI * 2); sctx.fill();
    };
    const N = 44;
    // The broad wet band: strongest in the middle of the lower lip, fading toward the corners
    const broad = layer(() => {
      if (full) { sctx.globalAlpha = 0.05; sctx.beginPath(); polyPath(sctx, g.lipsOuter, true); sctx.fill(); }
      for (let i = 0; i <= N; i++) {
        const s = i / N, env = Math.sin(Math.PI * s);
        blob(along(g.lowerCenter, 0.1 + 0.8 * s), thick * (full ? 0.5 : 0.62), 0.11 * env);
        if (full) blob(along(g.upperCenter, 0.22 + 0.56 * s), g.upperH * 0.32, 0.06 * env);
      }
    }, Math.max(1, Math.round(thick * (full ? 0.18 : 0.34))));
    // Tiny bright speculars (full gloss and oil only)
    let spec = null;
    if (full) {
      const r = rng(7);
      spec = layer(() => {
        for (let i = 0; i < 8; i++) {
          const p = along(g.lowerCenter, 0.25 + 0.5 * r());
          blob({ x: p.x + (r() - 0.5) * thick * 0.5, y: p.y + (r() - 0.5) * thick * 0.4 }, g.faceW * 0.0024, 0.95);
        }
        for (let i = 0; i < 6; i++) {
          const p = along(g.upperCenter, 0.3 + 0.4 * r());
          blob({ x: p.x, y: p.y + (r() - 0.5) * g.upperH * 0.25 }, g.faceW * 0.0018, 0.9);
        }
      }, 1);
    }
    const bg = M.highlight * k * (full ? 0.4 : 0.42), sg = M.highlight * k * 0.8;
    const h = new Float32Array(mask.w * mask.h);
    for (let i = 0; i < h.length; i++) {
      h[i] = clamp(broad[i] * bg + (spec ? spec[i] * sg : 0), 0, 1) * mask.a[i];
    }
    return h;
  }

  function paintLips(it, M) {
    const k = it.intensity, X = M.extra || {};
    let op = M.opacity;
    if (X.clear && X.clear.test(it.shadeName || "")) op = 0;
    else if (X.opaque && X.opaque.test(`${it.shadeName} ${it.lineName}`)) op = X.opaqueOpacity;
    const C = rgb(it.hex);
    const mask = makeMask([g.lipsOuter, g.lipsInner], M.feather * sc, { smooth: true, key: "lips" });
    if (!mask) return;
    const m = meanLuma(mask) || 128;
    const cap = m * (1.08 + (1 - M.compress) * 3); // matte products flatten the highlights
    const hl = M.highlight > 0 ? highlightMap(mask, M, k) : null;
    const cx = g.mouthC.x, hw = g.mouthW / 2;
    // Split the lip light into BIG shading (upper lip darker than lower) and FINE texture (creases).
    // Creases stay (textureKeep); the big shading is only partly kept, so one shade looks like one shade.
    const lb = new Float32Array(mask.w * mask.h);
    for (let y = 0; y < mask.h; y++) for (let x = 0; x < mask.w; x++) {
      const i = ((mask.y0 + y) * W + mask.x0 + x) << 2;
      lb[y * mask.w + x] = lumaOf(work[i], work[i + 1], work[i + 2]);
    }
    boxBlur(lb, mask.w, mask.h, Math.max(2, Math.round(g.faceW * 0.006)), 2);

    forMask(mask, (i, a, x, y, mi) => {
      const r0 = work[i], g0 = work[i + 1], b0 = work[i + 2];
      const l = lumaOf(r0, g0, b0);
      const le = l > cap ? cap : l;
      const local = lb[mi] || m;
      let detail = le / local; detail = detail < 0.5 ? 0.5 : detail > 1.6 ? 1.6 : detail;
      let ratio = Math.pow(detail, M.textureKeep) * Math.pow(local / m, 0.35);
      ratio = ratio < 0.4 ? 0.4 : ratio > 1.6 ? 1.6 : ratio;
      const aa = M.edgeFade ? Math.pow(a, 1 + 2.2 * M.edgeFade) : a;
      let deep = 1; // slightly deeper at the mouth corners
      if (M.corner) { const q = (Math.abs(x - cx) / hw - 0.68) / 0.32; if (q > 0) deep = 1 - M.corner * (q > 1 ? 1 : q); }
      const nat = M.highlight > 0 && l > m * 1.2 ? ((l - m * 1.2) / (255 - m * 1.2 + 1)) * M.highlight * 0.9 : 0;
      const amt = clamp(op * k * aa, 0, 1);
      const spark = M.shimmer && hash2(x, y) < M.shimmer ? (0.3 + 0.5 * hash2(y + 7, x)) * 0.6 * aa * k : 0;
      const o = [r0, g0, b0];
      for (let c = 0; c < 3; c++) {
        // the shade, seen through the natural lip color (20% multiply)
        let col = (C[c] * ratio * 0.76 + (o[c] * C[c]) / 255 * 1.3 * 0.24) * deep;
        col = col > 255 ? 255 : col;
        if (nat) col += (255 - col) * nat;
        let v = o[c] + (col - o[c]) * amt;
        if (hl) v += (255 - v) * hl[mi];
        if (spark) v += (255 - v) * spark;
        work[i + c] = v;
      }
    });
  }

  // Lip liner: a fine line on the lip edge, with a soft fade inward
  function paintLipline(it, M) {
    const k = it.intensity, C = rgb(it.hex);
    const w = g.faceW * 0.0046 * M.width;
    const r = rng(11);
    const ring = (shift, thick) => {
      const c = g.mouthC;
      const outerPts = g.lipsOuter.map((p) => {
        const d = norm(sub(p, c));
        return add(p, mul(d, shift + thick / 2 + (r() - 0.5) * w * 0.25)); // slightly irregular edge
      });
      const innerPts = g.lipsOuter.map((p) => add(p, mul(norm(sub(p, c)), shift - thick / 2)));
      return [outerPts, innerPts];
    };
    const line = makeMask(ring(w * 0.3, w), M.feather * sc, { smooth: true });
    const fade = makeMask(ring(-w * 2, w * 6), 5 * sc, { smooth: true });
    if (fade) paintColor(fade, C, M.inward * k, { keep: 0.25 });
    if (line) paintColor(line, C, M.opacity * k, { keep: 0.15 });
  }

  // =======================================================
  // B. FACE BASE
  // =======================================================
  function samples(poly) {
    return poly.map((p) => lumaAt(p.x, p.y));
  }

  function paintSkin(it, M) {
    const k = it.intensity, C = rgb(it.hex);
    const holes = [...g.eyes.map((e) => [...e.upper, ...e.lower.slice().reverse()]), ...g.brows.map((b) => b.poly), g.lipsOuter];
    // The oval is pulled in a little (especially at the top) so hair and headbands are left alone
    const c = g.center;
    const oval = g.oval.map((p) => ({ x: c.x + (p.x - c.x) * 0.965, y: c.y + (p.y - c.y) * (p.y < c.y ? 0.9 : 0.97) }));
    const mask = makeMask([oval, ...holes], M.feather * sc, { smooth: true, key: "skin" });
    if (!mask) return;
    const m = meanLuma(mask, 0.8) || 128;

    // A slightly softened copy: evens out fine texture but keeps pores and freckles
    let blurred = null;
    if (M.soften >= 0.08 && !live) {
      const n = mask.w * mask.h;
      blurred = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
      for (let y = 0; y < mask.h; y++) for (let x = 0; x < mask.w; x++) {
        const wx = mask.x0 + x, wy = mask.y0 + y;
        const i = (wy * W + wx) << 2, j = y * mask.w + x;
        blurred[0][j] = work[i]; blurred[1][j] = work[i + 1]; blurred[2][j] = work[i + 2];
      }
      const rad = Math.max(1, Math.round(g.faceW * 0.0035));
      for (const ch of blurred) boxBlur(ch, mask.w, mask.h, rad, 1);
    }
    const glow = M.glow > 0 ? makeMask(g.glowShapes, 34 * sc, { smooth: true, normalize: true, key: "glow" }) : null;

    forMask(mask, (i, a, x, y, mi) => {
      let r0 = work[i], g0 = work[i + 1], b0 = work[i + 2];
      // Skin only: dark hair and pink headbands (green below blue) are left untouched
      a *= clamp((g0 - b0 + 6) / 14, 0, 1) * clamp((lumaOf(r0, g0, b0) / m - 0.4) / 0.25, 0, 1);
      if (a <= 0.004) return;
      if (blurred) {
        const s = M.soften * a;
        r0 += (blurred[0][mi] - r0) * s; g0 += (blurred[1][mi] - g0) * s; b0 += (blurred[2][mi] - b0) * s;
      }
      let l = lumaOf(r0, g0, b0);
      if (M.compress > 0 && l > m * 1.1) { // calm down shine
        const t = m * 1.1 + (l - m * 1.1) * (1 - M.compress * a);
        const f = t / l;
        r0 *= f; g0 *= f; b0 *= f; l = t;
      }
      setLum(C[0], C[1], C[2], l); // the shade's color with the skin's own light and dark
      const amt = clamp(M.evenAmt * k * a, 0, 1);
      let o0 = r0 + (out3[0] - r0) * amt, o1 = g0 + (out3[1] - g0) * amt, o2 = b0 + (out3[2] - b0) * amt;
      if (glow) {
        const gl = glow.a[(y - glow.y0) * glow.w + (x - glow.x0)] || 0; // cheekbones, forehead, nose bridge
        const s = M.glow * k * gl * a;
        o0 += (255 - o0) * s; o1 += (255 - o1) * s; o2 += (255 - o2) * s;
      }
      work[i] = o0; work[i + 1] = o1; work[i + 2] = o2;
    });
  }

  function paintConcealer(it, M) {
    const k = it.intensity, C = rgb(it.hex);
    const mask = makeMask(g.eyes.map((e) => e.under), M.feather * sc, { smooth: true, key: "under" });
    if (!mask) return;
    // How bright the cheek skin is: dark circles are darker than this
    const cheekPts = g.cheeks.flatMap((c) => {
      const out = [];
      for (const dx of [-0.5, 0, 0.5]) for (const dy of [-0.5, 0, 0.5]) {
        out.push({ x: c.center.x + dx * g.faceW * 0.1, y: c.center.y + dy * g.faceW * 0.06 });
      }
      return out;
    });
    const around = samples(cheekPts).reduce((s, v) => s + v, 0) / cheekPts.length || 140;

    forMask(mask, (i, a) => {
      const r0 = work[i], g0 = work[i + 1], b0 = work[i + 2];
      const l = lumaOf(r0, g0, b0);
      const dark = clamp((around - l) / (around * 0.45), 0, 1);
      let w, c0, c1, c2;
      if (M.mode === "neutralize") {
        const blue = clamp((b0 - r0 + 12) / 45, 0, 1); // dark circles lean blue / purple
        w = Math.max(dark, blue * 0.6);
        setLum(C[0], C[1], C[2], l * 1.1 + 6);          // peach / orange neutralizes blue
      } else {
        w = 0.3 + 0.7 * dark;                           // works mostly where it is dark
        setLum(C[0], C[1], C[2], l + (around * 1.03 - l) * 0.6);
      }
      c0 = out3[0]; c1 = out3[1]; c2 = out3[2];
      const amt = clamp(M.coverage * k * a * w, 0, 1);
      let o0 = r0 + (c0 - r0) * amt, o1 = g0 + (c1 - g0) * amt, o2 = b0 + (c2 - b0) * amt;
      if (M.radiance) { const s = M.radiance * k * a * 0.5; o0 += (255 - o0) * s; o1 += (255 - o1) * s; o2 += (255 - o2) * s; }
      work[i] = o0; work[i + 1] = o1; work[i + 2] = o2;
    });
  }

  // =======================================================
  // C. CHEEKS
  // =======================================================
  function paintBlush(it, M) {
    const k = it.intensity, C = rgb(it.hex);
    const rx = g.faceW * 0.165 * M.spread, ry = g.faceW * 0.082 * M.spread;
    const polys = g.cheeks.map((c) => ellipsePoly(c.center.x, c.center.y, rx, ry, c.angle));
    const mask = makeMask(polys, M.feather * sc, { normalize: true, key: "blush|" + M.spread });
    if (!mask) return;
    const rand = M.grain ? rng(5) : null;
    forMask(mask, (i, a, x, y) => {
      const aa = Math.pow(a, 1 + 2 * M.edgeFade);           // strongest in the middle
      const r0 = work[i], g0 = work[i + 1], b0 = work[i + 2];
      const l = lumaOf(r0, g0, b0);
      setLum(C[0], C[1], C[2], l * 0.93);
      const amt = clamp(M.opacity * k * aa, 0, 1);
      const apex = Math.max(0, (a - 0.6) / 0.4);
      const sheen = M.sheen * k * apex * apex;
      const grain = rand ? (rand() - 0.5) * 2 * M.grain * 255 * a : 0;
      // Glowy: a soft luminous screen over the cheek + a few fine pearl particles on the apple
      const glow = M.glow ? M.glow * k * Math.pow(a, 1.6) : 0;
      const pearl = M.shimmer && hash2(x, y) < M.shimmer * apex ? (0.3 + 0.5 * hash2(y + 5, x)) * 0.55 * k : 0;
      const o = [r0, g0, b0];
      const t = [0, 0, 0];
      for (let c = 0; c < 3; c++) t[c] = out3[c] * 0.72 + ((o[c] * C[c]) / 255) * 1.25 * 0.28; // soft-light feel, texture stays
      if (M.boost && M.boost !== 1) { const gy = lumaOf(t[0], t[1], t[2]); for (let c = 0; c < 3; c++) t[c] = gy + (t[c] - gy) * M.boost; }
      for (let c = 0; c < 3; c++) {
        let v = o[c] + (t[c] - o[c]) * amt + grain;
        v += (255 - v) * (sheen + glow);
        if (pearl) v += (255 - v) * pearl;
        work[i + c] = v;
      }
    });
  }

  function paintContour(it, M) {
    const k = it.intensity;
    const C0 = rgb(it.hex);
    const gray = lumaOf(...C0);
    const C = C0.map((v) => v * 0.5 + gray * 0.5); // cooler and more neutral: a shadow, never orange paint
    const mask = makeMask(g.cheeks.flatMap((c) => [c.contour, c.jaw]), M.feather * sc, { smooth: true, normalize: true, key: "contour" });
    if (!mask) return;
    forMask(mask, (i, a) => {
      const amt = clamp(M.opacity * k * a, 0, 1);
      for (let c = 0; c < 3; c++) {
        const o = work[i + c];
        const shadow = Math.min(255, (o * C[c]) / 255 * 1.22);
        work[i + c] = o + (shadow - o) * amt;
      }
    });
  }

  function paintHighlighter(it, M) {
    const k = it.intensity, C = rgb(it.hex);
    const mask = makeMask(g.highlightShapes, M.feather * sc, { smooth: true, normalize: true, key: "highlight" });
    if (!mask) return;
    forMask(mask, (i, a, x, y) => {
      const amt = clamp(M.opacity * k * a, 0, 1);
      const sparkle = M.shimmer && hash2(x, y) < M.shimmer * 0.5 ? (0.3 + 0.7 * hash2(y + 3, x)) * 0.5 * a * k : 0;
      for (let c = 0; c < 3; c++) {
        const o = work[i + c];
        const screen = 255 - ((255 - o) * (255 - C[c] * 0.95)) / 255; // light on the skin
        let v = o + (screen - o) * amt;
        if (sparkle) v += (255 - v) * sparkle;
        work[i + c] = v;
      }
    });
  }

  // =======================================================
  // D. EYES
  // =======================================================
  // Liner shape along the upper lash line: thin at the inner corner, fuller at the outer end
  function linerPolys(eye, M, wing) {
    const lash = eye.upper, last = lash.length - 1;
    const thick = g.faceW * 0.0075 * M.thickness;
    const bottom = lash.map((p) => add(p, mul(eye.up, -thick * 0.2)));
    const top = lash.map((p, i) => add(p, mul(eye.up, thick * (0.3 + 0.7 * Math.pow(i / last, 1.6)))));
    const poly = [...bottom];
    if (wing) {
      // the wing follows the line from the lower lid, through the outer corner, lifted about 15°
      const v = norm(sub(eye.outer, eye.lower[eye.lower.length - 2]));
      const dir = norm(add(v, mul(eye.up, 0.27)));
      poly.push(add(eye.outer, mul(dir, eye.width * 0.2)));
    }
    poly.push(...top.slice().reverse());
    return poly;
  }

  function paintLiner(it, M, name) {
    const k = it.intensity, C = rgb(it.hex);
    const dark = lumaOf(...C) < 60;
    const beigeOnly = /beige/i.test(name);
    const op = (beigeOnly ? 0.6 : dark ? 0.85 : 0.7) * k;
    const feather = M.feather * sc;
    if (!beigeOnly) {
      const polys = g.eyes.map((e) => linerPolys(e, M, M.wing));
      const line = makeMask(polys, feather);
      if (M.smudge > 0) { // a soft halo, like a real smudged pencil
        const halo = makeMask(polys, 1.6 * sc + 1);
        if (halo) paintColor(halo, C, M.smudge * k * 0.6, { keep: 0.2 });
      }
      if (line) {
        paintColor(line, C, op, { keep: dark ? 0.05 : 0.2 });
        if (M.sheen > 0) { // a narrow specular strip along the line
          forMask(line, (i, a) => {
            const t = Math.pow(a, 3) * M.sheen * k;
            for (let c = 0; c < 3; c++) work[i + c] += (255 - work[i + c]) * t;
          });
        }
      }
    }
    // Kohl also goes on the lower waterline (60% strength); Beige goes only there. Open eyes only.
    if (M.lower) {
      const polys = g.eyes.filter((e) => !e.closed).map((e) => {
        const thick = g.faceW * 0.0035;
        return [...e.lower.map((p) => add(p, mul(e.up, thick * 0.4))), ...e.lower.slice().reverse().map((p) => add(p, mul(e.up, -thick * 0.6)))];
      });
      if (polys.length) {
        const mask = makeMask(polys, feather * 1.2);
        if (mask) paintColor(mask, C, op * (beigeOnly ? 1 : 0.6), { keep: 0.2 });
      }
    }
  }

  function paintMascara(it, M) {
    const k = it.intensity, C = rgb(it.hex);
    const rand = rng(21);
    const jobs = g.eyes.map((e) => {
      const lashLen = e.width * 0.2 * M.length;
      const n = Math.round((M.lashes * e.width) / 190);
      const dirSign = e.closed ? -1 : 1; // closed eyes: lashes point down from the lid edge
      const base = dirSign > 0 ? e.up : mul(e.up, -1);
      const lashes = [];
      for (let i = 0; i < n; i++) {
        const t = (i + (rand() - 0.5) * M.separation) / (n - 1);
        const tt = clamp(t, 0, 1);
        const p0 = along(e.upper, tt);
        const env = 0.55 + 0.45 * Math.sin(Math.PI * Math.pow(tt, 0.75)); // longest in the middle/outer part
        const length = lashLen * env * (0.85 + 0.3 * rand());
        const lean = e.axis; // lashes lean toward the outer corner
        const dir = norm(add(base, mul(lean, 0.3 + 0.35 * tt + (rand() - 0.5) * 0.25 * M.separation)));
        const control = add(p0, mul(dir, length * 0.5));
        const tip = add(add(p0, mul(dir, length)), mul(base, length * M.curl * 0.3));
        lashes.push({ p0, control, tip, w: 0.8 + 0.5 * rand(), a: 0.7 + 0.3 * rand() });
      }
      return { e, lashes, lower: e.closed ? [] : lowerLashes(e, M, rand) };
    });
    function lowerLashes(e, M, rand) {
      const out = [];
      const n = Math.round(10 * (e.width / 190));
      for (let i = 0; i < n; i++) {
        const tt = 0.1 + 0.8 * (i / (n - 1));
        const p0 = along(e.lower, tt);
        const dir = norm(add(mul(e.up, -1), mul(e.axis, 0.2 * (rand() - 0.3))));
        const length = e.width * 0.09 * M.length * (0.8 + 0.4 * rand());
        out.push({ p0, control: add(p0, mul(dir, length * 0.5)), tip: add(p0, mul(dir, length)), w: 0.6, a: 0.45 });
      }
      return out;
    }
    const polys = jobs.flatMap((j) => [j.e.upper, j.e.lower, ...j.lashes.map((l) => [l.p0, l.tip]), ...j.lower.map((l) => [l.p0, l.tip])]);
    const layer = strokeLayer(polys, 6, (c) => {
      c.strokeStyle = "#000";
      const unit = g.faceW * 0.0021;
      for (const j of jobs) {
        for (const l of [...j.lashes, ...j.lower]) {
          // thicker at the base, thinner toward the tip
          c.globalAlpha = l.a;
          c.lineWidth = unit * l.w * 1.25;
          c.beginPath(); c.moveTo(l.p0.x, l.p0.y); c.quadraticCurveTo(l.control.x, l.control.y, (l.control.x + l.tip.x) / 2, (l.control.y + l.tip.y) / 2); c.stroke();
          c.lineWidth = unit * l.w * 0.65;
          c.beginPath(); c.moveTo((l.control.x + l.tip.x) / 2, (l.control.y + l.tip.y) / 2); c.lineTo(l.tip.x, l.tip.y); c.stroke();
        }
      }
    });
    // Existing lashes get darker too: a thin band along the lash line
    const band = makeMask(g.eyes.map((e) => {
      const th = g.faceW * 0.004;
      return [...e.upper.map((p) => add(p, mul(e.up, th))), ...e.upper.slice().reverse().map((p) => add(p, mul(e.up, -th * 0.6)))];
    }), 1.2 * sc + 0.5);
    if (band) paintColor(band, C, 0.4 * k, { keep: 0 });
    if (layer) paintColor(layer, C, 0.85 * k, { keep: 0 });
  }

  // =======================================================
  // E. BROWS
  // =======================================================
  // Fine hair strokes that follow how brow hair grows: up at the front, arching toward the tail
  function browStrokes(brow, count, rand, lenScale) {
    const strokes = [];
    for (let i = 0; i < count; i++) {
      const t = clamp(Math.pow(rand(), 0.85), 0.02, 0.98);
      const v = rand();
      const lo = along(brow.lower, t), up = along(brow.upper, t);
      const base = lerp(lo, up, v);
      const tan = norm(sub(along(brow.upper, Math.min(1, t + 0.04)), along(brow.upper, Math.max(0, t - 0.04))));
      const lift = norm(sub(up, lo));
      const dir = norm(add(mul(tan, 0.35 + 0.65 * t), mul(lift, 0.95 * Math.pow(1 - t, 1.4) + 0.1)));
      const length = brow.height * lenScale * (0.9 + 0.7 * rand());
      strokes.push({ a: base, b: add(base, mul(dir, length)), w: 0.7 + 0.5 * rand(), alpha: 0.55 + 0.4 * rand() });
    }
    return strokes;
  }

  function paintBrows(it, M) {
    const k = it.intensity, C = rgb(it.hex);
    const clear = /transparent|clear/i.test(it.shadeName || "");
    const mask = makeMask(g.brows.map((b) => b.poly), g.brows[0].height * 0.16, { smooth: true, key: "brows" });
    if (!mask) return;

    // Which pixels are hair? Darker than the skin around them.
    const ls = [];
    forMask(mask, (i, a) => { if (a > 0.5) ls.push(lumaOf(work[i], work[i + 1], work[i + 2])); });
    ls.sort((a, b) => a - b);
    const skin = ls[Math.floor(ls.length * 0.88)] || 150;
    const hairW = (l) => clamp((skin * 0.86 - l) / (skin * 0.5), 0, 1);

    const rand = rng(33);
    // Hair strokes (pomade fills gaps, pen draws them)
    if (M.mode === "pomade" || M.mode === "pen") {
      const count = M.mode === "pen" ? 70 : 50;
      const strokes = g.brows.flatMap((b) => browStrokes(b, count, rand, M.mode === "pen" ? 0.95 : 1.25));
      const layer = strokeLayer(g.brows.map((b) => b.poly), 8, (c) => {
        c.strokeStyle = "#000";
        const unit = g.faceW * 0.0014;
        for (const s of strokes) {
          c.globalAlpha = s.alpha; c.lineWidth = unit * s.w * (M.mode === "pen" ? 1 : 1.25);
          c.beginPath(); c.moveTo(s.a.x, s.a.y); c.lineTo(s.b.x, s.b.y); c.stroke();
        }
      });
      if (layer) {
        // keep strokes inside the brow area
        forMask(layer, (i, a, x, y, li) => {
          const mx = x - mask.x0, my = y - mask.y0;
          const inside = mx >= 0 && my >= 0 && mx < mask.w && my < mask.h ? mask.a[my * mask.w + mx] : 0;
          layer.a[li] = a * Math.min(1, inside * 1.6);
        });
        paintColor(layer, C, (M.mode === "pen" ? M.opacity : M.fill) * k, { keep: 0.1 });
      }
    }

    // Color the existing hairs
    if (M.mode === "pomade" || M.mode === "tint") {
      const amount = (clear ? 0.05 : M.opacity) * k;
      forMask(mask, (i, a) => {
        const r0 = work[i], g0 = work[i + 1], b0 = work[i + 2];
        const l = lumaOf(r0, g0, b0);
        const w = hairW(l) * a;
        if (w <= 0) return;
        setLum(C[0], C[1], C[2], clear ? l * 0.95 : l + (lumaOf(C[0], C[1], C[2]) - l) * 0.5);
        const m = clamp(amount * w * 1.15, 0, 1);
        work[i] = r0 + (out3[0] - r0) * m; work[i + 1] = g0 + (out3[1] - g0) * m; work[i + 2] = b0 + (out3[2] - b0) * m;
        if (M.sheen) { const s = M.sheen * k * w; for (let c = 0; c < 3; c++) work[i + c] += (255 - work[i + c]) * s; }
      });
    }

    // Wax: no color, hairs look set and a little glossy
    if (M.mode === "wax") {
      forMask(mask, (i, a) => {
        const l = lumaOf(work[i], work[i + 1], work[i + 2]);
        const w = hairW(l) * a;
        if (w <= 0) return;
        const s = M.sheen * k * w;
        for (let c = 0; c < 3; c++) work[i + c] = work[i + c] * (1 - 0.03 * w) + (255 - work[i + c]) * s;
      });
    }
  }

  // ---------- Debug: show every region so it can be checked by eye ----------
  function drawDebug(landmarks) {
    ctx.save();
    ctx.lineWidth = Math.max(1, W / 700);
    const stroke = (pts, color, closed = true) => {
      ctx.strokeStyle = color; ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      if (closed) ctx.closePath();
      ctx.stroke();
    };
    ctx.fillStyle = "rgba(0,255,255,.55)";
    for (const p of landmarks) ctx.fillRect(p.x * W - 0.8, p.y * H - 0.8, 1.6, 1.6);
    stroke(g.oval, "#0f0");
    stroke(g.lipsOuter, "#f0f"); stroke(g.lipsInner, "#f0f");
    stroke(g.lowerCenter, "#fff", false); stroke(g.upperCenter, "#fff", false);
    for (const e of g.eyes) { stroke(e.upper, "#ff0", false); stroke(e.lower, "#fa0", false); stroke(e.under, "#f80"); }
    for (const b of g.brows) stroke(b.poly, "#0af");
    for (const c of g.cheeks) { stroke(ellipsePoly(c.center.x, c.center.y, g.faceW * 0.12, g.faceW * 0.075, c.angle), "#f66"); stroke(c.contour, "#a60"); stroke(c.jaw, "#a60"); }
    for (const s of g.highlightShapes) stroke(s, "#fff");
    ctx.restore();
  }

  // =======================================================
  // Render one frame
  // =======================================================
  const PAINT = {
    lip: paintLips, lipline: paintLipline, skin: paintSkin, concealer: paintConcealer,
    blush: paintBlush, contour: paintContour, highlighter: paintHighlighter,
    liner: paintLiner, mascara: paintMascara, brows: paintBrows,
  };

  /**
   * source    <img>, <video> or <canvas> holding the face
   * landmarks MediaPipe points for one face, or null
   * look      [{ material, hex, shadeName, lineName, intensity }]
   * options   { before: show the photo without makeup, debug: draw regions,
   *             maxSide: cap the working size (the live camera uses a smaller one) }
   */
  function render(source, landmarks, look, { before = false, debug = false, maxSide = 2048, live: isLive = false } = {}) {
    const sw = source.videoWidth || source.naturalWidth || source.width;
    const sh = source.videoHeight || source.naturalHeight || source.height;
    if (!sw || !sh) return;
    const scale = Math.min(1, maxSide / Math.max(sw, sh));
    const nw = Math.round(sw * scale), nh = Math.round(sh * scale);
    if (canvas.width !== nw || canvas.height !== nh) { canvas.width = nw; canvas.height = nh; }
    W = nw; H = nh;
    live = isLive;
    ctx.drawImage(source, 0, 0, W, H);
    if (!landmarks) return;
    // A new face or a new size: forget the saved masks
    const sig = W + "x" + H;
    if (landmarks !== cacheKey?.lm || sig !== cacheKey?.sig) { cache.clear(); cacheKey = { lm: landmarks, sig }; }

    const items = before ? [] : look.map((it) => ({ it, M: materialFor(it.material, it.lineName) })).filter((x) => x.M && x.it.hex);
    items.sort((a, b) => SLOT_ORDER.indexOf(a.M.slot) - SLOT_ORDER.indexOf(b.M.slot));
    if (items.length) {
      const img = ctx.getImageData(0, 0, W, H);
      work = img.data;
      g = geometry(landmarks);
      sc = g.faceW / 1000;
      g.light = lightDirection();
      timings.length = 0;
      for (const { it, M } of items) {
        const paint = PAINT[M.kind];
        if (!paint) continue;
        const t0 = performance.now();
        const item = { ...it, intensity: (it.intensity ?? M.defaultIntensity ?? 1) };
        if (M.kind === "liner") paint(item, M, `${it.shadeName || ""}`);
        else paint(item, M);
        timings.push([it.material, Math.round(performance.now() - t0)]);
      }
      ctx.putImageData(img, 0, 0);
    } else if (debug) {
      g = geometry(landmarks);
    }
    if (debug && g) { if (!items.length) { sc = g.faceW / 1000; } drawDebug(landmarks); }
  }

  return { render, get geometry() { return g; }, get timings() { return timings; } };
}
