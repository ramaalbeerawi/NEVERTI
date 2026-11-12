# NEVERTI — Virtual try-on: every product must look like the real product

Read this together with `NEVERTI_BUILD_PROMPT.md` (section 9) and `.claude/skills/neverti-brand/references/try-on.md`.

The owner is a beginner. Explain every step in simple Jordanian Arabic, build in the phases at the end, and **stop after each phase** so she can test it.

## 0. Goal and priorities

When a visitor applies any Neverti product to a photo (the model photo, an uploaded selfie, or the live camera), the result must look like that exact product applied to real skin:

- A matte lipstick must look matte, a gloss must look wet and shiny, a lip oil must look glassy and almost transparent, a cream blush must look like cream, a liquid blush like a stain, a liquid liner like glossy ink, a brow pomade like filled brows, and so on.
- **Realism is the top priority, even if it is slower.** Never paint a flat color over the skin. Every product is rendered with its own *material* (opacity, blend mode, highlights, edge softness, texture).
- The real skin texture (pores, freckles, lip creases) and the photo's own lighting must stay visible under every product.
- **In scope:** only products that Neverti sells (see section 6). **No eyeshadow.** No brushes, skincare or sunscreen try-on.

## 1. Technology

- Landmarks: MediaPipe `FaceLandmarker` (`@mediapipe/tasks-vision`, pinned version, CDN), `IMAGE` mode for photos and `VIDEO` mode for the camera, GPU delegate with CPU fallback. Request blendshapes off, 1 face.
- Rendering: a main `<canvas>` over the source plus offscreen canvases. Work at the photo's native resolution (cap the longest side at 2048 px). Use `ctx.filter = 'blur(Npx)'` for feathering, `globalCompositeOperation` for blend modes, and per-pixel `ImageData` processing for the lip, skin and brow recolor passes. If a pass is too slow in the live camera, move it to a WebGL fragment shader. Photos render once at full quality; the camera renders at a reduced internal resolution.
- Live camera: smooth the landmarks with an exponential moving average (alpha ≈ 0.5) so makeup does not jitter. Mirror the view.
- Everything runs on the visitor's device. No image is uploaded anywhere.

## 2. Landmark map (starting points — verify visually)

Prefer the library's own constants (`FaceLandmarker.FACE_LANDMARKS_LIPS`, `..._LEFT_EYE`, `..._RIGHT_EYE`, `..._LEFT_EYEBROW`, `..._RIGHT_EYEBROW`, `..._FACE_OVAL`) to order the contours. These index lists are a fallback:

- Lips outer: 61,146,91,181,84,17,314,405,321,375,291,409,270,269,267,0,37,39,40,185
- Lips inner: 78,95,88,178,87,14,317,402,318,324,308,415,310,311,312,13,82,81,80,191
- Mouth corners 61 and 291, upper-lip center 0, lower-lip center 17.
- Eye on the left of the image: outer corner 33, inner 133, upper lid 246,161,160,159,158,157,173, lower lid 7,163,144,145,153,154,155.
- Eye on the right of the image: outer corner 263, inner 362, upper lid 466,388,387,386,385,384,398, lower lid 249,390,373,374,380,381,382.
- Brow on the left of the image: upper 70,63,105,66,107, lower 46,53,52,65,55. Brow on the right: upper 300,293,334,296,336, lower 276,283,282,295,285.
- Cheek apples: about 50 (left of image) and 280 (right of image), surrounded by 117,118,101,205 and 346,347,330,425.
- Ear-side face edge for contour: 234 (left of image) and 454 (right of image). Nose bridge: 168,6,197,195,5. Nose tip: 1. Forehead: 10,151,9. Chin: 152,175. Face oval: 10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109.
- Derived regions: under-eye crescent = lower-lid points pushed down by about 0.6 × eye height; cheekbone highlight = a band from each outer eye corner sloping down toward the temple side; contour hollow = a band from the ear-side points toward the cheek apple, ending under the pupil's x position; foundation area = face oval minus eyes, brows and lips.

**Required debug mode:** `?debug=1` draws the landmarks and every region polygon so the regions can be checked by eye. Do not skip this; check each region on the model photo before moving on.

## 3. Rendering rules shared by every product

1. Build a mask from the landmark polygon, feather it (blur radius scales with face width, listed per material).
2. **Colorize, never fill.** Keep the pixel's own luminance variation. Reference method for lip and skin products: compute each pixel's luma `l`, the region's mean luma `m`; the product color `C` becomes `out = C × clamp((l / m) ^ textureKeep, 0.35, 1.8)`; then `result = mix(original, out, opacity × mask)`. `textureKeep` is about 0.6 for matte, 0.85 for satin, 1.0 for sheer products.
3. **Highlights are separate from color.** Specular areas are the pixels brighter than about `m × 1.3`. Matte products compress them (`l' = min(l, m × 1.08)`); glossy products boost them and add synthetic highlights (see materials).
4. The shade on skin must look different from the swatch: it is influenced by the person's own skin and lip color. Use `multiply`, `soft-light` or `color` blends, not plain `source-over`, except for fully opaque matte products where a mix of normal and multiply is used.
5. Light direction: estimate it from the photo (compare mean brightness on the left vs right half of the face) and place synthetic highlights and shadows consistently.
6. Layer order (bottom to top): foundation / BB → corrector → concealer → powder → contour → blush → highlighter → brows → eyeliner → mascara → lip liner → lipstick → gloss / oil.
7. Every product has an intensity slider (0–100%) that scales its opacity and highlight strength. Default to the real product's natural intensity.
8. Layers stack; the "Now wearing" list shows each one; a "Before / After" button holds the original photo.

## 4. Material schema (`js/tryon/materials.js`)

```js
{
  id: "matte-liquid-lipstick",
  region: "lips",
  opacity: 0.94,          // 0–1, coverage of the product
  textureKeep: 0.6,       // how much of the natural texture remains
  blend: "color+normal",  // blend recipe name used by the renderer
  highlight: 0.0,         // 0 = none, 1 = very glossy
  highlightShape: "none", // none | center-lower | full | pearl
  shimmer: 0.0,           // density of fine pearl/sparkle particles
  feather: 0.8,           // edge softness in px at 1000 px face width
  edgeFade: 0.0,          // 0–1 pigment fades toward edges (stain effect)
  extra: {}               // type-specific options
}
```
Each product in `js/products.js` references a `material` id and has `hex` and `hexSource`.

## 5. Material library — every type, in detail

### A. LIPS (mask = outer lip contour minus inner mouth, so open mouths work)

**A1. Matte liquid lipstick — Matte Couture (matte)**
- opacity 0.94–0.97, textureKeep 0.55, highlight 0, feather 0.6–0.8 (crisp, clean edge).
- Fully opaque, velvety, flat finish. Compress all specular highlights. Keep only a faint trace of the lip creases (about 25% of original lip texture).
- Slightly deeper tone at the mouth corners. The shade covers the natural lip color almost completely.

**A2. Cream / regular lipstick — Be Brave lipstick (satin bullet)**
- opacity 0.85–0.9, textureKeep 0.75, highlight 0.2, highlightShape center-lower, feather 0.8.
- Satin: a soft broad glow on the center of the lower lip only, creases still clearly visible (about 40–50%), clean edge.

**A3. Soft Tint liquid lipstick (stain / tint)**
- opacity 0.55–0.7, textureKeep 0.95, edgeFade 0.35, highlight 0.15, feather 1.6.
- Stain-like: more pigment in the center, fading toward the edges; natural lip texture and creases fully visible; a faint wet sheen. Pure `multiply` + `color` blend.

**A4. Plumping gloss — 3D Plumping Gloss (all shades, including clear "Gloss Me")**
- opacity 0.3–0.45 (clear shade: 0.0, shine only), textureKeep 1.0, highlight 0.9, highlightShape full, feather 1.8 (soft, no crisp edge).
- Sheer color over the natural lip, very wet look: one large soft specular band on the center of the lower lip, a thinner highlight along the upper-lip peaks, plus a few tiny bright speculars with micro-noise. The lip must look plumper only through light (do not warp the geometry). Chocolate / brown shades are slightly more opaque (0.5).

**A5. Shimmer gloss — Be Allure shine gloss (pearl gloss)**
- Same as A4 (opacity 0.35–0.5, highlight 0.8) plus shimmer 0.08: fine pearlescent particles (1–2 px, random, slightly different brightness) concentrated at the center of the lips.

**A6. Lip oil — Lip Oil Cocktail (Raspberry, Apricot, Grape, Pomegranate)**
- opacity 0.15–0.25 (a light tint of the shade), textureKeep 1.0, highlight 1.0, highlightShape full, feather 2.2, edgeFade 0.
- Glassy and wet: the strongest, most continuous highlight of all lip products across both lips, lips look hydrated and plump, natural lip color clearly visible through the tint. No defined edge.

**A7. Lip balm gloss — Shea Butter Honey Milk lip balm gloss**
- opacity 0–0.08 (almost clear), highlight 0.4, feather 2.0. Subtle healthy shine only, no color.

**A8. Lip liner pencil**
- Draw a thin line along the outer lip contour: width about 1.5–2.5 px at 1000 px face width, opacity 0.75–0.85, matte, very slightly irregular edge. Optionally shade 15–20 px inward with a fading gradient ("blended liner").
- Works as a base under any lipstick: when stacked, the lipstick overlaps the inner half of the liner so the liner reads as a deeper outline (this is the lip-combo look).

**Lip combo preset (the look she loves):** liner → matte or satin lipstick → thin gloss on the center of the lower lip. Provide it as a one-click "Lip combo" in the UI that stacks these three.

### B. FACE BASE (mask = face oval minus eyes, brows and lips, feathered about 12 px)

**B1. Foundation — Soft Focus (matte-soft finish)**
- Evens the skin tone toward the shade (`color` blend about 35–45% + soft-light), reduces redness and uneven areas, slightly softens fine texture (blend 10–15% of a blurred copy) but **keeps pores and freckles visible**. Matte-soft look: compress highlights on forehead, nose and cheeks by about 15%.

**B2. Foundation — Natural Glow (radiant)**
- Same evening-out (35–45%) with less softening (5–8%) and a gentle radiant finish: add a very soft highlight on the cheekbones, forehead center and nose bridge (screen blend at 10–15%). Skin looks fresh, not shiny.

**B3. BB Gel Cream — Tinted Gel Cream BB (sheer, dewy)**
- Sheer coverage (about 20–30%), dewy: slight overall luminosity, freckles clearly still visible. Natural tint rather than a mask.

**B4. Concealer — Serum Concealer (light-medium, radiant)**
- Region: under-eye crescent, plus optional inner-corner, nose sides and chin spots. Brighten and cover dark circles: shade-colored `soft-light` + `screen` at 35–50%, feather 8–10 px, with a subtle luminous finish. Eight shades; the shade color also tints the area, so a wrong shade looks visibly different (that is correct behavior).

**B5. Concealer stick — Pure Perfection concealer stick (full coverage, matte-soft)**
- Same region, higher coverage (55–70%), matte, blends cleanly; also usable on spots (let the user tap to place a spot).

**B6. Color corrector — Radiant Creamy Cover (peach / mango)**
- Under-eye only, targeted at dark areas: detect darker, bluish areas under the eye and neutralize them with a peach / orange `color` blend at 30–45%, feather 6–8 px. Meant to sit under concealer.

**B7. Pressed powder — Creamy Dimension Waterproof Powder; Loose setting powder**
- Mattify: compress highlights by 20–25% (pressed) or 30–40% (loose); tint the skin only 6–10% toward the powder color; soften fine texture a little more for loose (10%). No added shine. Subtle, but the shine on the nose and forehead must visibly calm down.

**B8. Primer (Matte Primer Base) and sunscreen**
- No visible try-on. Show a small note "Prep step — no visible color" and a very light mattify (5–8%) for the primer, or hide the Try on button for them.

### C. CHEEKS

**C1. Cream blush — Lush Blush (pot)**
- Region: cheek apple sweeping slightly toward the temple, soft elliptical blob, feather large (about 30–40 px). opacity 0.4–0.6, `multiply` + `soft-light` so skin texture and freckles show through. Cream finish: a faint dewy sheen on the highest point of the cheek (screen 6–8%). Slightly more intense in the center than the edges.

**C2. Liquid blush — Fit Check liquid blush (stain)**
- More diffuse and sheer: opacity 0.3–0.45, very large soft spread, edgeFade high so it disappears into the skin, skin completely visible through it, natural flush look, tiny sheen only.

**C3. Powder-cream blush compact (creamy blush compact)**
- Matte, fine-particle finish: opacity 0.35–0.5, medium feather, no sheen; very light fine-grain noise at 3% to suggest powder.

**C4. Contour stick (cream) — Deep Dimension / Sculpt**
- Region: the hollow of the cheek, a narrow band from the ear-side landmark toward the cheek apple, plus optional jaw edge and sides of the nose. Neutral-cool brown / taupe, matte, opacity 0.3–0.5, feather 18–25 px, `multiply`. It must read as a shadow under the cheekbone, never as orange paint.

**C5. Liquid highlighter — Double Gleam / Rosy Glow**
- Region: cheekbone band above the blush, nose bridge, Cupid's bow, inner eye corner. Pearl finish: `screen` / `add` at 25–40% with the shade (champagne-gold or pink pearl), shimmer 0.1 of tiny light-reactive particles, feather 14–20 px. It should look like light on the skin, not glitter paint.

### D. EYES (use the lid landmarks; the eye can be open, looking down, or closed)

**D1. Kohl pencil — Define Liner (Black, Deep Black, Brown, Burgundy, Plum, Beige)**
- Draw along the upper lash line, thickness about 2–3 px at 1000 px face width, tapered at the inner corner, opacity 0.85 (black / deep black), 0.7 (brown / burgundy / plum). Creamy matte with a soft smudge halo (blur 1.2 px at 25%). Optional lower lash line / waterline at 60% of the strength. **Beige** is applied on the lower waterline only, brightening the eye (opacity 0.6, matte).
- Colored shades shift the hue slightly toward the lid skin tone, never neon.

**D2. Liquid liner pen — Hi-Shine liquid liner (24H)**
- A thin crisp line along the upper lash line, with a precise tapered wing option (the wing direction follows the line from the lower-lid outer corner through the outer corner, angled up about 15°). Opacity 0.95, glossy black: add a narrow specular highlight strip (screen 15%) along the line.

**D3. Matte dip liner (liquid, matte)**
- Same geometry as D2 with a slightly thicker line (about 3 px), opacity 0.97, strictly matte (no highlight), very crisp edge. Wing option.

**D4. Gel liner pot — Midnight Whisper**
- A smooth, creamy line about 3 px thick, opacity 0.9, very slightly softer edge than liquid (feather 0.8), a faint satin sheen. Wing option.

**D5. Mascara — Lash Me Up (all-in-one), Volume Manifest (volume), Maxi Length Manifest (length), Beauty Boost (length + lift), Beauty Boost Volume**
- This is the hardest product to make realistic; do it carefully and keep it subtle.
- Approach: (1) detect the existing lashes along the lash line (thin dark structures near the lid edge, by local contrast) and darken them toward near-black; (2) add synthetic lashes drawn as thin tapered curved strokes starting on the lash line, following the eyelid normal and curl, with random length, angle and thickness (variation ±15%), near-black, opacity 0.55–0.85, a tiny blur (0.3–0.5 px) so they match the photo's sharpness; (3) lower lashes lighter and shorter.
- Parameters per product: length ×1.0–1.4, density, curl, separation. Lash Me Up: length ×1.25, density medium, curl medium. Volume Manifest: length ×1.1, density high, slight clumping at the roots. Maxi Length Manifest: length ×1.4, density medium, very separated. Beauty Boost: length ×1.3, strong curl, medium density. Beauty Boost Volume: length ×1.2, density high.
- For closed eyes (the model photo), lashes point downward from the lid edge; use the correct normal direction.

### E. BROWS (mask from the brow landmarks; separate the existing hairs from skin by darkness)

**E1. Brow pomade — Latte Light, Auburn, Mocha Mist, Espresso Shot**
- Colorize the existing brow hairs with the shade (`multiply` + `color`) and **fill sparse gaps** with fine individual hair strokes (thin, tapered, following the growth direction: upward at the inner part, arching toward the tail). Opacity 0.55–0.7, denser at the tail with a defined crisp tail end, soft at the front. Matte.
- Shades: Latte Light (light brown), Auburn (warm reddish brown), Mocha Mist (cool medium brown), Espresso Shot (deep brown).

**E2. Tinted brow mascara — Brow Up (Clear, Brown, Medium Brown, Dark Chocolate)**
- Tint only the existing hairs (no filling): hair-pixel mask × shade at 40–55%, a slight sheen on the hairs (screen 6–8%), a subtle "brushed up" look by slightly brightening the upper edge of the hairs. **Clear** adds only sheen and 5% darkening, no color.

**E3. Brow styler pen — liquid microblading-style pen (Grey, Brown, Black)**
- Draw fine individual hair strokes between and over the sparse parts of the brows: thin (about 1 px), tapered, 8–12 px long, angled along growth, opacity 0.6–0.85, slightly varied, crisp. Black and grey are darker and cooler; brown is warm.

**E4. Brow shaping wax (clear)**
- No color. Adds definition and a soft sheen to the hairs (screen 6%), hairs look slightly set and more separated.

## 6. Product → material mapping (from Neverti's catalog)

| Product | Material |
|---|---|
| Matte Couture liquid lipstick (all shades) | A1 |
| Be Brave lipstick | A2 |
| Soft Tint liquid lipstick | A3 |
| 3D Plumping Gloss (all shades) | A4 |
| Be Allure shine gloss | A5 |
| Lip Oil Cocktail (all flavors) | A6 |
| Shea Butter Honey Milk lip balm gloss | A7 |
| Lip liner | A8 |
| Soft Focus Foundation | B1 |
| Natural Glow Foundation | B2 |
| Tinted BB Gel Cream | B3 |
| Serum Concealer (all 8 shades) | B4 |
| Pure Perfection concealer stick | B5 |
| Radiant Creamy Cover (peach / mango) | B6 |
| Creamy Dimension powder, Loose setting powder | B7 |
| Matte primer base, sunscreen | B8 |
| Lush Blush cream | C1 |
| Fit Check liquid blush | C2 |
| Creamy blush compact | C3 |
| Contour stick | C4 |
| Liquid highlighters (Double Gleam, Rosy Glow) | C5 |
| Define Liner kohl pencils | D1 |
| Hi-Shine liquid liner | D2 |
| Matte Dip liner | D3 |
| Midnight Whisper gel liner | D4 |
| Mascaras (Lash Me Up, Volume Manifest, Maxi Length Manifest, Beauty Boost, Beauty Boost Volume) | D5 |
| Brow pomade | E1 |
| Brow Up mascara | E2 |
| Brow styler pen | E3 |
| Brow shaping wax | E4 |
| Brushes, skincare, boxes | no try-on |

If a product in `products.js` does not match any row, ask her instead of guessing.

## 7. Shade colors from the real swatches

Each product photo from Neverti's store shows the product with a swatch smear beside it. When the product images are downloaded into `assets/images/products/`, sample the swatch automatically: find the largest saturated region that is not the packaging, take the median color of its core pixels, and store it as `hex` with `hexSource: "swatch"`. Show her a table of the sampled colors so she can correct any that look wrong, and let her override a hex by hand.

## 8. UI of the try-on page

- Three sources: **Take a photo** (camera), **Upload a photo**, **Our model** (default). Clear messages when camera permission is denied or no face is found.
- Product-type tabs: Lips, Face, Cheeks, Eyes, Brows. Under each tab, the real products with their shades as round swatches and the material name ("Matte", "Gloss", "Oil", "Cream blush"...).
- A **Lip combo** one-click preset. An intensity slider per applied product. A "Now wearing" list with remove buttons. **Before / After** (hold). **Add this look to bag** adds every applied product with its shade.
- A **Materials lab** page, `try-on-lab.html`: renders every material side by side on the model photo (one tile per material, labeled), so she can compare them and approve the look of each type. Build this first, before the main UI.

## 9. Realism quality check (do this before showing her anything)

For each material, apply it on the model photo and confirm:
- Matte lipstick: no highlights, creases barely visible, crisp edge. Gloss: clearly wet, color sheer. Lip oil: more transparent and shinier than gloss. Tint: visible lip texture, pigment fades to the edges. Cream lipstick: satin glow, between matte and gloss.
- Foundation: skin evens out but pores and freckles stay visible. Concealer: under-eye is brighter without a mask look. Powder: the shine calms down.
- Cream blush vs liquid blush vs powder blush are visibly different from each other. Contour looks like a shadow, highlighter looks like light.
- Liner follows the lash line exactly and is thin. Mascara lashes look like lashes, not like a drawing. Pomade fills brows with hair-like strokes, brow mascara only tints the existing hairs.
- No edge halos, no visible mask outlines, no hard pixel edges, no colors that look painted.

If a material fails any check, fix it before moving on, and show her the before/after of your fix.

## 10. Phases (stop after each one)

1. **Engine + Materials lab + all lip materials (A1–A8) + Lip combo.** She tests them in the lab page.
2. **Face base and cheeks (B1–B8, C1–C5).**
3. **Eyes: liners and mascara (D1–D5).**
4. **Brows (E1–E4).**
5. **Full UI, stacking, intensity, Before/After, add look to bag, live-camera smoothing and performance.**
6. **Final realism pass and a checklist of known limits.**

After each phase tell her in Arabic: what you built, how to open it with Live Server, what to click to test it, and what comes next. If a material cannot be made convincingly realistic with 2D rendering (mascara is the likeliest), tell her honestly and suggest the best approximation instead of shipping something that looks fake.