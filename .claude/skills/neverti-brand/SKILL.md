---
name: neverti-brand
description: Brand and design system for the Neverti makeup website concept (portfolio project). Use this skill whenever the user works on anything for Neverti or the "makeup" website project — new pages, sections, components, colors, fonts, backgrounds, product grids, the try-on feature, AI image prompts for the site, or copy — even if they only say "the website", "the makeup site", "add a section", or "make it look like the rest". It keeps every output consistent with the decisions already made and prevents the flat, "cartoon" look the user dislikes.
---

# Neverti Brand & Website System

Neverti is a makeup brand (lips, face, eyes, brows) whose name comes from Queen Nefertiti, a symbol of beauty and strength. This project is a portfolio concept website for it. Every decision below was made with the user; follow it unless she asks to change something.

## Working with this user

- Explain in Jordanian Arabic, short and simple. She gets overwhelmed by long lists and jargon.
- Before any big change or new direction, describe the plan in a few lines and wait for her OK. For small fixes, just do them.
- Show, don't describe: when choosing colors, layouts or styles, build a visual preview she can compare.
- Be honest when something cannot look real with a given technique; offer the realistic alternative.

## The #1 rule: nothing may look "cartoon"

The user's biggest frustration is designs that look fake. Causes and fixes:

| Never | Instead |
|---|---|
| Draw products, lips, brushes, faces with SVG/CSS | Use real photos (AI-generated photoreal or stock) for anything physical |
| Slide a cut-out PNG across the screen | Keep photos still; animate reveals, masks, slow zooms, page transitions |
| Flat pure colors (pure red, pure black, flat pink) | Colors sampled from the real textures below |
| Many playful animations, sparkles, bouncing | Few, slow, calm motions |
| Mixing images with different light/color | One "photoshoot": same light, same cream background, same skin |
| Script/handwriting fonts, many fonts | Playfair Display + Manrope only |

## Background (locked — do not change)

- One background for the whole site: the smooth warm cream stone texture (file `tex-4.jpg`, average color ≈ `#E8D5C2`).
- Always apply a light calming layer on top: `linear-gradient(rgba(245,238,230,0.4), rgba(245,238,230,0.4)), url(tex-4.jpg)`, `background-size: cover`, `background-attachment: fixed`.
- Never add other background textures or colored section backgrounds. Separate sections with spacing and a thin line: `1px solid rgba(87,36,43,0.15)`.
- Panels/modals/dropdowns: same texture with a stronger cream layer (`rgba(250,244,237,0.7)`).

## Colors

From the real textures:
- Stone light `#E8D6C2` · stone mid `#E5D0BB` · stone dark `#DDCFB5`
- Lipstick light `#C80B27` · lipstick mid `#A40018` · lipstick deep `#7F020A`

Interface:
- Text, buttons, dark accents: burgundy `#57242B` (hover `#3F161D`)
- Secondary text: `#6B3A3A` · small labels: `#7A4848`
- Light text on burgundy: `#F2E0C3`
- Accent (small touches only — badges, count dots): gold `#CFA06D`
- Also in the palette: smoky rose `#905D5D`, champagne `#F7E7CE`

Rules: text is always burgundy on cream; never gold or smoky rose for small text (too low contrast).

## Typography

- Display / headings / logo: **Playfair Display** (500 for headings, 700–800 for the logo/name, italics for one emphasized word).
- Body / UI: **Manrope** (400–600).
- Logo: `NEVERTI` in caps, letter-spacing ~0.3em.
- Hero name can be filled with the real lipstick texture (`background-clip: text` with `lipstick-texture.jpg`), revealed left to right with a soft mask.
- Small labels: 12px, uppercase, letter-spacing 0.2–0.4em.

## Site structure (agreed)

1. **Offers bar** (top): burgundy, slow marquee, only real current offers.
2. **Navbar**: logo · `Collections ▾` (mega dropdown: 4 collections with photo + product types) · `New ▾` (New arrivals, Best sellers, The red edit) · `Our story ▾` · **Try on** (filled button) · right side: Sign in / My account / Sign out, Bag with gold count.
3. **Homepage (long scroll)**: New arrivals (two product rows moving in opposite directions, pause on hover) → Shop by collection (4 photo cards) → Best sellers grid → Try-on invitation → The red edit (wide lips photo) → Our story → Footer (shop links, contact, newsletter).
4. **Collection pages**: opened by clicking the photo itself (not text links). Pages are "thrown" in one after another and stack; the top page shows the collection photo as a wide banner with the name on the cream area, filter chips (All + types), product count, and a large product grid.
5. **Collections**: Lips (Liquid lipstick, Gloss, Lip oil) · Face (Concealer, Foundation, Blush, Contour & glow) · Eyes (Mascara, Eyeliner) · Brows (Pomade, Brow mascara, Pencil & wax). Lips is the "hero" collection and sits in front.
6. **Login**: optional for browsing; adding to the bag asks the visitor to sign in (small modal, not a full page), then adds the item automatically.

## Components

- Buttons look like buttons: pill shape, 1px burgundy border, uppercase 12px, hover fills burgundy. Primary = filled burgundy.
- Product tile: square photo slot, name, price `SAR 00.00`, full-width outlined "Add to bag" button.
- Cards/photos: soft burgundy shadow `0 18px 36px rgba(60,25,30,.2)`, no rounded corners on photos.
- Respect `prefers-reduced-motion`.

## Imagery

Section photos are extreme close-ups of one model, shot from the front with a slight tilt, warm olive skin with light freckles, soft warm daylight, and a plain warm cream area on the right side (for text). Read `references/image-prompts.md` before writing any image prompt.

Product photos come from Neverti's own store (white background, swatch next to the product) — use them as they are.

## Virtual try-on

Do not draw makeup with hand-made SVG paths over a photo — it looks fake (especially eyeliner). Use **MediaPipe Face Landmarker** (`@mediapipe/tasks-vision`, free, runs in the browser) on the webcam, an uploaded selfie, or the model photo; apply each product as a color (hex) + finish (matte, gloss, tint) on the detected lips/eyes/cheeks with soft edges and texture-preserving blending. Camera needs HTTPS or localhost (VS Code Live Server). See `references/try-on.md`.

## Products

Product data format and the current list: `references/products.md`.
