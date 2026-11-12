// =========================================================
// NEVERTI — tryon/materials.js
// How each type of Neverti product behaves on skin.
// (Follows TRYON_REALISM_PROMPT.md, sections 4 and 5. Letters A–E match it.)
//
// Common fields
//   kind       which drawing routine the engine uses
//   slot       what it replaces in "Now wearing" (one product per slot)
//   opacity    0–1 coverage          textureKeep  how much natural texture stays
//   highlight  0 none … 1 very glossy  shape       none | center-lower | full | pearl
//   shimmer    density of pearl particles
//   feather    edge softness in px at 1000 px face width
//   edgeFade   0–1: pigment fades toward the edges (stain effect)
// =========================================================

export const MATERIALS = {
  // ---------- A. LIPS ----------
  "matte-liquid-lipstick": {   // A1  Matte Couture
    kind: "lip", slot: "lipstick", label: "Matte liquid",
    opacity: 0.97, textureKeep: 0.4, compress: 1, highlight: 0, shape: "none",
    shimmer: 0, feather: 0.6, edgeFade: 0, corner: 0.14, defaultIntensity: 1,
  },
  "matte-lipstick": {          // A1  Matt Idole, Matt Mallow (bullet, matte)
    kind: "lip", slot: "lipstick", label: "Matte bullet",
    opacity: 0.86, textureKeep: 0.8, compress: 0.75, highlight: 0.06, shape: "center-lower",
    shimmer: 0, feather: 1.0, edgeFade: 0.08, corner: 0.06, defaultIntensity: 1,
  },
  "satin-lipstick": {          // A2  Let Lip Rejoice, Limitless Kiss (cream / satin)
    kind: "lip", slot: "lipstick", label: "Satin cream",
    opacity: 0.88, textureKeep: 0.8, compress: 0.2, highlight: 0.32, shape: "center-lower",
    shimmer: 0, feather: 0.8, edgeFade: 0, corner: 0.04, defaultIntensity: 1,
  },
  "shine-lipstick": {          // A2  Kiss Adore Shiny Lipstick
    kind: "lip", slot: "lipstick", label: "Shiny cream",
    opacity: 0.84, textureKeep: 0.9, compress: 0, highlight: 0.62, shape: "center-lower",
    shimmer: 0, feather: 1.0, edgeFade: 0, corner: 0.03, defaultIntensity: 1,
  },
  "lip-tint": {                // A3  Soft Tint (stain)
    kind: "lip", slot: "lipstick", label: "Tint / stain",
    opacity: 0.5, textureKeep: 1, compress: 0.5, highlight: 0.06, shape: "center-lower",
    shimmer: 0, feather: 2.4, edgeFade: 0.8, corner: 0, defaultIntensity: 1,
  },
  "tinted-balm": {             // A7  Creamy Lip Balm (tinted)
    kind: "lip", slot: "lipstick", label: "Tinted balm",
    opacity: 0.72, textureKeep: 0.85, compress: 0, highlight: 0.75, shape: "center-lower",
    shimmer: 0, feather: 1.4, edgeFade: 0, corner: 0, defaultIntensity: 1,
  },
  "plumping-gloss": {          // A4  3D Plumping Gloss
    kind: "lip", slot: "gloss", label: "Plumping gloss",
    opacity: 0.38, textureKeep: 1, compress: 0, highlight: 0.9, shape: "full",
    shimmer: 0, feather: 1.8, edgeFade: 0, corner: 0, defaultIntensity: 1,
    extra: { clear: /^gloss me$/i, opaque: /chocolate|brown/i, opaqueOpacity: 0.5 },
  },
  "shimmer-gloss": {           // A5  Be Allure Up Shine
    kind: "lip", slot: "gloss", label: "Shimmer gloss",
    opacity: 0.42, textureKeep: 1, compress: 0, highlight: 0.8, shape: "pearl",
    shimmer: 0.035, feather: 1.8, edgeFade: 0, corner: 0, defaultIntensity: 1,
  },
  "lip-oil": {                 // A6  Lip Oil Cocktail
    kind: "lip", slot: "gloss", label: "Lip oil",
    opacity: 0.2, textureKeep: 1, compress: 0, highlight: 1, shape: "full",
    shimmer: 0, feather: 2.2, edgeFade: 0, corner: 0, defaultIntensity: 1,
  },
  "lip-liner": {               // A8  Lip liners
    kind: "lipline", slot: "lipliner", label: "Lip liner pencil",
    opacity: 0.85, width: 1, feather: 0.6, inward: 0.3, defaultIntensity: 1,
  },

  // ---------- B. FACE BASE ----------
  "foundation-soft-matte": {   // B1  Soft Focus, Natural Matte Flawless
    kind: "skin", slot: "foundation", label: "Soft-matte foundation",
    evenAmt: 0.36, soften: 0.15, compress: 0.32, glow: 0, feather: 14, defaultIntensity: 1,
  },
  "foundation-glow": {         // B2  Natural Glow
    kind: "skin", slot: "foundation", label: "Radiant foundation",
    evenAmt: 0.34, soften: 0.06, compress: 0, glow: 0.2, feather: 14, defaultIntensity: 1,
  },
  "bb-cream": {                // B3  Tinted Gel Cream BB (sheer, dewy)
    kind: "skin", slot: "foundation", label: "Dewy BB gel",
    evenAmt: 0.3, soften: 0.05, compress: 0, glow: 0.13, feather: 14, defaultIntensity: 1,
  },
  "concealer-serum": {         // B4  Serum / Radiant Creamy Cover concealer
    kind: "concealer", slot: "concealer", label: "Radiant serum concealer",
    mode: "conceal", coverage: 0.45, radiance: 0.1, feather: 9, defaultIntensity: 1,
  },
  "concealer-stick": {         // B5  Pure Perfection stick
    kind: "concealer", slot: "concealer", label: "Full-cover stick",
    mode: "conceal", coverage: 0.65, radiance: 0, feather: 7, defaultIntensity: 1,
  },
  "color-corrector": {         // B6  Radiant Creamy Corrector (peach / mango)
    kind: "concealer", slot: "corrector", label: "Color corrector",
    mode: "neutralize", coverage: 0.4, radiance: 0, feather: 7, defaultIntensity: 1,
  },
  "powder-pressed": {          // B7  Creamy Dimension / Wet & Dry powder
    kind: "skin", slot: "powder", label: "Pressed powder",
    evenAmt: 0.08, soften: 0.06, compress: 0.22, glow: 0, feather: 14, defaultIntensity: 1,
  },
  "powder-loose": {            // B7  Loose setting powder
    kind: "skin", slot: "powder", label: "Loose setting powder",
    evenAmt: 0.08, soften: 0.12, compress: 0.5, glow: 0, feather: 14, defaultIntensity: 1,
  },

  // ---------- C. CHEEKS ----------
  "cream-blush": {             // C1  Lush Blush
    kind: "blush", slot: "blush", label: "Cream blush",
    opacity: 0.55, feather: 100, spread: 1, edgeFade: 0.4, sheen: 0.12, grain: 0, defaultIntensity: 1,
  },
  "liquid-blush": {            // C2  Liquid blush (stain)
    kind: "blush", slot: "blush", label: "Liquid blush",
    opacity: 0.36, feather: 160, spread: 1.3, edgeFade: 0.9, sheen: 0.02, grain: 0, defaultIntensity: 1,
  },
  "powder-cream-blush": {      // creamy compact: like a powder, a little more saturated, smooth, faint satin skin finish
    kind: "blush", slot: "blush", label: "Powder-cream blush",
    opacity: 0.52, feather: 72, spread: 0.95, edgeFade: 0.3, sheen: 0.02, grain: 0, boost: 1.3, defaultIntensity: 1,
  },
  "glowy-blush": {             // Creamy Dimension: a creamy compact with a luminous, dewy finish
    kind: "blush", slot: "blush", label: "Glowy blush",
    opacity: 0.48, feather: 105, spread: 1.05, edgeFade: 0.35, sheen: 0.1, glow: 0.2, shimmer: 0.07, grain: 0, defaultIntensity: 1,
  },
  "powder-blush": {            // C3  Creamy Dimension blush compact (matte, fine grain)
    kind: "blush", slot: "blush", label: "Powder blush",
    opacity: 0.44, feather: 56, spread: 0.9, edgeFade: 0.25, sheen: 0, grain: 0.05, defaultIntensity: 1,
  },
  "contour": {                 // C4  Contour sticks
    kind: "contour", slot: "contour", label: "Contour",
    opacity: 0.55, feather: 48, defaultIntensity: 1,
  },
  "highlighter": {             // C5  Liquid / waterproof highlighters
    kind: "highlighter", slot: "highlighter", label: "Pearl highlighter",
    opacity: 0.48, feather: 36, shimmer: 0.1, defaultIntensity: 1,
  },

  // ---------- D. EYES ----------
  "kohl-liner": {              // D1  Define Liner
    kind: "liner", slot: "eyeliner", label: "Kohl pencil",
    thickness: 1, wing: false, feather: 0.9, smudge: 0.25, sheen: 0, lower: true, defaultIntensity: 1,
  },
  "liquid-liner": {            // D2  Hi-Shine liquid liner
    kind: "liner", slot: "eyeliner", label: "Glossy liquid liner",
    thickness: 0.9, wing: true, feather: 0.5, smudge: 0, sheen: 0.15, lower: false, defaultIntensity: 1,
  },
  "matte-liquid-liner": {      // D3  Matte Dip liner
    kind: "liner", slot: "eyeliner", label: "Matte liquid liner",
    thickness: 1.2, wing: true, feather: 0.5, smudge: 0, sheen: 0, lower: false, defaultIntensity: 1,
  },
  "gel-liner": {               // D4  Midnight Whisper gel liner
    kind: "liner", slot: "eyeliner", label: "Gel liner",
    thickness: 1.2, wing: true, feather: 0.8, smudge: 0.1, sheen: 0.06, lower: false, defaultIntensity: 1,
  },
  "mascara": {                 // D5  Mascaras (per-product variants below)
    kind: "mascara", slot: "mascara", label: "Mascara",
    lashes: 30, length: 1.2, curl: 0.5, separation: 0.6, clump: 0, defaultIntensity: 1,
    variants: [
      { match: /lash me up/i,          length: 1.25, lashes: 30, curl: 0.5, separation: 0.6 },
      { match: /big volume|volume manifest/i, length: 1.1, lashes: 42, curl: 0.4, separation: 0.3, clump: 0.35 },
      { match: /max length/i,          length: 1.4,  lashes: 28, curl: 0.45, separation: 0.9 },
      { match: /volume & lift|volume and lift/i, length: 1.2, lashes: 40, curl: 0.7, separation: 0.45 },
      { match: /length & define|length and define/i, length: 1.3, lashes: 30, curl: 0.75, separation: 0.6 },
    ],
  },

  // ---------- E. BROWS ----------
  "brow-pomade": {             // E1  BrowTastic gel / pomade
    kind: "brows", slot: "brows", label: "Brow pomade",
    mode: "pomade", opacity: 0.62, fill: 0.6, defaultIntensity: 1,
  },
  "brow-mascara": {            // E2  Brow Up (tints existing hairs only)
    kind: "brows", slot: "brows", label: "Tinted brow mascara",
    mode: "tint", opacity: 0.5, sheen: 0.07, defaultIntensity: 1,
  },
  "brow-pen": {                // E3  Brow styler pen (fine hair strokes)
    kind: "brows", slot: "brows", label: "Brow styler pen",
    mode: "pen", opacity: 0.75, defaultIntensity: 1,
  },
  "brow-wax": {                // E4  Brow shaping wax (clear)
    kind: "brows", slot: "browwax", label: "Clear brow wax",
    mode: "wax", opacity: 0, sheen: 0.06, defaultIntensity: 1,
  },
};

// Order the layers are painted, bottom to top
export const SLOT_ORDER = [
  "foundation", "corrector", "concealer", "powder", "contour", "blush", "highlighter",
  "brows", "browwax", "eyeliner", "mascara", "lipliner", "lipstick", "gloss",
];

export const SLOT_LABEL = {
  foundation: "Foundation", corrector: "Corrector", concealer: "Concealer", powder: "Powder",
  contour: "Contour", blush: "Blush", highlighter: "Highlighter", brows: "Brows", browwax: "Brow wax",
  eyeliner: "Eyeliner", mascara: "Mascara", lipliner: "Lip liner", lipstick: "Lipstick", gloss: "Gloss & oil",
};

// Try-on tabs
export const GROUPS = [
  { id: "lips", label: "Lips" },
  { id: "face", label: "Face" },
  { id: "cheeks", label: "Cheeks" },
  { id: "eyes", label: "Eyes" },
  { id: "brows", label: "Brows" },
];

// Mascara: pick the settings for this exact product
export function materialFor(id, lineName = "") {
  const base = MATERIALS[id];
  if (!base) return null;
  const variant = base.variants?.find((v) => v.match.test(lineName));
  return variant ? { ...base, ...variant } : base;
}
