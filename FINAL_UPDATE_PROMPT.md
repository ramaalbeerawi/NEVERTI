# NEVERTI — FINAL UPDATE (UI changes + every product used exactly as it is + undertone)

This is the last update on top of the site that already exists. **First read** `CLAUDE.md`, `NEVERTI_BUILD_PROMPT.md`, `TRYON_REALISM_PROMPT.md`, `PROGRESS.md` (if it exists), the skill in `.claude/skills/neverti-brand/`, and look at the current code. **Do not rebuild what already works.** Change only what this document asks.

The owner is a beginner. Explain everything in simple Jordanian Arabic.

## 0. How to work

- Do all sections below, one after the other, **without stopping for approval in between.** Ask me only about something that only I can provide. If you must wait for it, build everything else first and use a safe fallback.
- Keep `PROGRESS.md` updated (each task: done / in progress / blocked). If you are stopped, I will write "continue" and you resume from it.
- **Test everything yourself before telling me it works:** run the site locally, open the pages with Playwright at desktop and phone sizes, take screenshots and look at them, check the console for errors, fix what you find.
- Nothing may look cartoon (see the skill). Do not delete or overwrite my existing work. Do not re-read or rewrite files that did not change (I have a usage limit).
- Reference code for the UI changes is in `final-ui-snippets.html`. Open it with Live Server to see it. Reuse its code; adapt the links and names to the real site.

---

## 1. UI changes

### 1.1 Opening intro: the real lipstick writes the name
My notes say the owner asked for "the name written by the lipstick pen, using the lipstick photo I sent". That is the intro in `final-ui-snippets.html` (section 1). If anything in this document is unclear to you, ask me before guessing.

- Add the full-screen intro to `index.html` exactly as in the snippet: stone background, the label "Inspired by Nefertiti", NEVERTI written stroke by stroke in block capitals filled with `assets/images/lipstick-texture.jpg` (with the bevel filter), and the real lipstick photo `assets/images/lipstick-red-sm.png` following the tip of every stroke (SMIL `animateMotion`, same timing as the CSS draw animation). When it finishes, the lipstick lifts away, the tagline appears, and the whole screen slides up to reveal the site.
- Plays **once per browser session** (`sessionStorage`). `?intro=1` forces it. A **Skip** button and the Escape key close it. Skipped for `prefers-reduced-motion`. Page scroll is locked while it plays.
- Keep the pen small on phones (the snippet has a media query). Check that the lipstick tip stays on the stroke; if it drifts, fix the coordinates, do not remove the effect.

### 1.2 Hero (first screen after the intro)
- **Remove the big empty space** between the header and the name: the name starts right under the header (small top padding only).
- **Remove the small NEVERTI logo from the header on the home page** (it duplicates the big name). Keep Bag and the menu button. On other pages the header logo stays.
- The name is the static version in the snippet (section 2): lipstick texture fill + bevel, no animation. Under it: the tagline and the two buttons (Shop new arrivals, Try on).

### 1.3 Collections: sliding panels
- **Replace the overlapping stacked photos** with the sliding panels from the snippet (section 3): four tall panels side by side, Lips open by default, the hovered or focused panel expands and the others shrink. Each panel is a link to its collection page and shows the name and the real product count from `js/products.js`.
- On phones the panels stack vertically (the snippet has the media query). Keyboard accessible (`:focus-visible` expands).
- Keep the rest of the home page as it is (New arrivals rows, Best sellers, try-on invitation, The red edit, Our story, footer).

---

## 2. Every product must be used exactly as it is (finish, texture, type)

The try-on must never treat all lipsticks as "red paint". Each product has its own real finish, and the try-on must render **that** finish. A matte lipstick is matte, a gloss is a gloss, an oil is an oil, a cream lipstick is cream, a powder blush is powder, a glowy blush is glowy, and so on.

### 2.1 Data fields (add to every product in `js/products.js`)
```js
finish: "matte",       // see the lists below
texture: "liquid",     // liquid | cream | powder | stick | gel | pencil | pot | compact
coverage: "full",      // sheer | medium | full
sheen: "none",         // none | satin | glossy | wet
shimmer: "none",       // none | fine | pearl | glitter
material: "A1",        // material id from TRYON_REALISM_PROMPT.md (extended below)
undertone: "warm",     // see section 3
finishEvidence: "name says 'matte'; swatch has no highlights"
```

**Lip finishes:** matte liquid lipstick · cream/satin lipstick (bullet) · soft tint/stain · gloss · shimmer gloss · lip oil · lip balm · lip liner.
**Blush finishes (these are different from each other):** powder blush (matte) · powder-cream blush (creamy compact, soft matte) · cream blush (pot, satin/dewy) · liquid blush (sheer, stain-like, dewy) · glowy blush (blush with a luminous finish).
**Face finishes:** foundation matte-soft · foundation radiant · BB/tinted gel dewy · concealer serum (radiant) · concealer stick (full, matte-soft) · color corrector · pressed powder · loose setting powder · contour (cream stick, matte) · highlighter (liquid, pearl).
**Eyes:** kohl pencil · liquid liner pen (glossy) · matte dip liner · gel liner pot · mascaras (volume, length, all-in-one, lift).
**Brows:** pomade · tinted brow mascara (clear / tinted) · brow pen · shaping wax.

### 2.2 How to decide the finish of each product (do all three checks)
1. **Name and description** (English and Arabic). Keywords: مطفي = matte · سائل = liquid · لامع / لمع / ملمع / غلوس = gloss · اويل / زيت = oil · كريمي = cream · بودرة = powder · تنت = tint · بلسم = balm · محدد = liner · اضاءة / هايلايتر = highlighter · كونتور = contour · كونسيلر = concealer · كحل = kohl / liner · ماسكارا = mascara · حواجب = brows · احمر خدود = blush · احمر شفاه = lipstick.
2. **The product photo.** Look at the swatch smear beside the product: opaque and flat = matte; thin and see-through = sheer or tint; clear highlights = gloss or wet; tiny sparkles = shimmer; a thick creamy smear = cream.
3. **Cross-check** the two. If they disagree, or you are not sure, **ask me**. **Never default to matte.**

Write the result to `PRODUCT_MATERIAL_MAP.md`: one table row per product (product, shade count, finish, texture, material id, evidence). I will review it. The try-on reads the material from the data, never from the color.

### 2.3 Show the finish everywhere
- A small finish label (for example "Matte", "Gloss", "Oil", "Cream blush", "Glowy") on product cards, the product page and in the try-on shade list.
- **Finish filter chips** on collection pages next to the type chips (for example Lips: Matte, Cream, Tint, Gloss, Oil; Blush: Powder, Cream, Liquid, Glowy).

### 2.4 Try-on: extra materials to add to `TRYON_REALISM_PROMPT.md`
Use the materials in that file, plus these (all must look different from each other in `try-on-lab.html`):
- **Powder blush (matte):** opacity 0.35–0.5, medium feather, no sheen, a very light fine-grain noise (about 3%).
- **Powder-cream blush (creamy compact):** same as powder but a little more saturated and smoother, a faint satin skin-like finish, no grain.
- **Cream blush (pot):** opacity 0.4–0.6, large feather, dewy: a faint sheen on the highest point of the cheek.
- **Liquid blush:** sheer, 0.3–0.45, very diffuse, stain-like, edges disappear into the skin.
- **Glowy blush:** like cream blush plus a soft luminous highlight (screen 10–15%) and a few fine pearl particles (shimmer about 0.05) on the cheek apple. It must look like light on skin, not glitter.
- Add a **side-by-side comparison row in the lab** for each group: all lip finishes with the same shade; all blush finishes with the same shade; all foundation finishes; all liner types; all brow types. I must be able to see at a glance that they are different.
- The product's shade color comes from its swatch hex and must not be changed by undertone logic. The person's own skin and lips influence the result only through the blend modes.

---

## 3. Undertone

### 3.1 Tag every shade
Add `undertone: "warm" | "cool" | "neutral"` to every shade of lipstick, blush, foundation, concealer and corrector, computed from its swatch hex:
- Convert the hex to CIELAB, then compute the hue angle `h = atan2(b*, a*)` in degrees.
- **Reds and pinks (lips, blush):** `h < 30°` cool (blue-based: berry, rose, mauve) · `30–45°` neutral · `> 45°` warm (orange-based: coral, tomato, brick).
- **Nudes and browns:** `h < 50°` cool · `50–60°` neutral · `> 60°` warm.
- **Foundation and concealer:** `h < 52°` cool (pink-based) · `52–62°` neutral · `> 62°` warm (yellow / golden-based).
- These thresholds are starting points. **Output a table of every shade with its computed undertone in `PRODUCT_MATERIAL_MAP.md` so I can correct it.**

### 3.2 Show it
- A small "Warm / Cool / Neutral" tag on shade swatches and on the product page. A filter chip "Undertone" on collection pages.
- In the try-on, when a shade is selected show its undertone, and if the visitor has a saved skin profile, a soft hint "Matches your undertone" or "Warmer than your undertone". It is a hint only, never a block.

### 3.3 Shade Match (build or finish it as in the previous brief)
- Page "Find my shade", link in the navbar. The visitor takes a selfie with the camera or uploads a photo. Use MediaPipe Face Landmarker, on-device, no upload.
- Sample skin on the cheeks, forehead and jaw. **Exclude** highlights, shadows, freckles, lips, brows and eyes: take the median of the middle luminance percentiles of those regions. Convert to CIELAB. Depth from `L*` (light, light-medium, medium, tan, deep). Skin undertone from the hue angle (starting point: `< 52°` cool, `52–62°` neutral, `> 62°` warm; calibrate on `model.png`). Report a confidence level.
- Show the result as "Closest match", with the closest foundation and concealer shades (CIEDE2000, preferring the same undertone), and blush and lip shades that suit the undertone and depth. Let her correct the result by hand. Note: use natural daylight and no filter. Never promise an "exact" match, say "closest".
- Save the skin profile in her Firebase account (or local demo storage while there are no keys). Use it to add "Matches your undertone" badges across the store and a "My undertone" filter.

---

## 4. Final checks

- Every lip, blush, face, eye and brow product has `finish`, `texture`, `material` and `undertone` set, and `PRODUCT_MATERIAL_MAP.md` is complete.
- In `try-on-lab.html` each finish looks different from the others. Fix any that does not, before you finish.
- The intro, hero and sliding panels work on desktop and phone, with no console errors.
- Firebase keys: if they are still missing, the local demo fallback keeps working. Tell me exactly what I must paste, and where.

When everything is finished, write me a final report in simple Jordanian Arabic: what you changed, how to open it with Live Server, what to click to test each change, what is still approximate, and the short list of things only I can do.
