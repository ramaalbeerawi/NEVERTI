# NEVERTI — progress

Legend: ✅ done · ⛔ needs the owner · ⚠️ approximate (see notes)

If you are stopped, write "continue": everything below is finished except the items marked ⛔.

## 0. Setup
- ✅ Folder structure, base/components/pages CSS, shared header/footer (offers bar, navbar + dropdowns, search, bag drawer, login modal, phone menu)
- ✅ Test tools in `tools/` (real Edge browser through playwright-core): `check_pages.mjs`, `test_flow.mjs`, `test_tryon.mjs`, `test_match.mjs`, `audit_a11y.mjs`, `perf_tryon.mjs`, `shot_lab.mjs`

## 1. Images
- ✅ bg-stone, collection photos, lipstick-texture (hero word), model.png (try-on), model-web.jpg (light copy for the home page)

## 2. Real products
- ✅ 325 products (90 grouped products, 325 shades) from neverti.com.sa, 325 images downloaded
- ✅ `tools/fetch_neverti.mjs` (store product feed) and `tools/scrape_playwright.mjs` (real pages in a real browser, presses "Load more"): the real pages show 325 products and all 325 are in the catalog
- ✅ Shade colors measured from swatches (+ hand fixes), `material` + `hexSource` per product, hand-override table in the Materials lab

## 3. Website
- ✅ Home (hero with texture word reveal + collection stack, new arrivals, shop by collection, best sellers, try-on invitation, red edit, story, help)
- ✅ Collection pages (thrown-pages transition, chips, sort, URL), product page (shade picker, quantity, Try this shade, related), search, bag drawer, checkout, account

## 4. Accounts
- ✅ Demo backend (works now, in this browser) and Firebase backend (email, Google, reset, bag, orders, newsletter, profile) behind one interface; protected pages; login-gated Add to bag
- ⛔ Real Firebase is untested because the keys are not available. Steps: FIREBASE_SETUP.md

## 5. Virtual try-on
- ✅ 32 materials (js/tryon/materials.js), per-pixel engine (js/tryon/makeup.js), `try-on-lab.html`, `?debug=1`, three sources, stacking, strength, Before/After, Now wearing, Lip combo, Add this look to bag
- ⚠️ See "Known limits" below

## 6. Shade Match
- ✅ shade-match.html, "Find my shade" in the navbar, manual adjustment, tap a spot, save to account, "Try my picks on"

## 7. Polish
- ✅ Phone/tablet layouts, accessibility audit clean, loading + empty + error states, speed work for the try-on

## Known limits (be honest)
- Eyeshadow, primer, setting spray, sunscreen, brushes, kits and the 3 Face Illusion palettes have no try-on (not in scope / not visible / multi-color).
- Mascara is drawn as synthetic lashes. On the closed-eye model it looks convincing; on photos with open eyes it depends on the lashes being visible. Real photos with heavy shadows or glasses will look less natural.
- Shade colors come from the swatch in each product photo. The Materials lab lets you fix any that look off.
- Shade Match depends on the light in the photo. It warns about uneven, dark or bright light, and has sliders.
- Product hex values for a few products with no visible color in the photo (clear glosses, Grape lip oil, mascaras, brow wax) were set by hand.
- Help text on the home page (shipping, returns, FAQ) is sample text.
- Payment is not connected (stated on the checkout page).
- The camera could only be tested with a fake camera feed (no real face in front of it).

---

# FINAL UPDATE (FINAL_UPDATE_PROMPT.md)

## 1. UI changes
- ✅ 1.1 Opening intro (lipstick writes NEVERTI), once per session, ?intro=1, Skip + Escape, reduced-motion skipped, scroll locked (tools/test_intro.mjs)
- ✅ 1.2 Hero: tight under the header, static bevel-textured name, no small logo in the header on the home page
- ✅ 1.3 Sliding collection panels (Lips open by default, hover/focus opens one, stack on phones). The old "Shop by collection" cards were removed (the panels replace them)

## 2. Every product used exactly as it is
- ✅ 2.1/2.2 finish, texture, coverage, sheen, shimmer, material, finishEvidence, confidence on every product (tools/product-finishes.mjs); Arabic text fetched (tools/fetch_neverti_ar.mjs); swatch photos checked (tools/contact_sheet.mjs)
- ✅ PRODUCT_MATERIAL_MAP.md generated (products + every shade's undertone + "Please review" list)
- ✅ 2.4 new materials (powder-cream blush, glowy blush), side-by-side comparison rows in try-on-lab.html
- ✅ 2.3 finish label on cards, product page ("Matte · Liquid · Full coverage") and try-on; finish filter chips on collection pages

## 3. Undertone
- ✅ 3.1 undertone on every lip/blush/foundation/concealer/corrector shade (CIELAB hue rules, overrides in tools/undertone-overrides.json)
- ✅ 3.2 Warm/Cool/Neutral tags on shades, undertone chips + "My undertone" chip, try-on and product-page hint, "Has shades for your undertone" badges (js/skin-profile.js)
- ✅ 3.3 Shade Match: cheeks + forehead + jaw, middle luminance percentiles, 5 depths, 3 undertones, confidence, CIEDE2000 preferring the same undertone, saved on the device and in the account. On model.png it reads Light, Cool, confidence Medium

## 4. Final checks
- ✅ tools/test_final.mjs (19 checks), test_intro, test_flow, test_tryon, test_match all pass; every page at desktop + phone with no console errors; accessibility audit clean
- ⚠️ Undertones follow the brief's hue thresholds: most lip swatches come out cool (lips: 1 product with a warm shade). Review the table in PRODUCT_MATERIAL_MAP.md
- ⛔ Firebase keys still needed (demo mode keeps working). See FIREBASE_SETUP.md
