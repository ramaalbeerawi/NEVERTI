# NEVERTI — Full website build brief (A to Z)

You are building a complete, professional e-commerce website for **Neverti**, a makeup brand named after Queen Nefertiti (a symbol of beauty and strength). It is a portfolio concept, but it must work like a real store: real sign-in, a saved bag, checkout that stores orders, and a realistic virtual try-on.

The project owner is a beginner who is learning. **Explain every step to her in simple Jordanian Arabic, build in phases, and stop after each phase so she can open the site and approve it before you continue.** Never skip ahead.

Before writing any code, read the skill in `.claude/skills/neverti-brand/` (SKILL.md and its references). It holds every design decision already approved. If anything in this brief and the skill disagree, ask her.

---

## 0. Ground rules

- **Nothing may look cartoon.** Never draw products, faces, lips or brushes with SVG/CSS shapes. Physical things are always real photos. Do not slide cut-out PNGs around the screen. Use calm, slow motion only.
- **One background for the whole site:** `assets/images/bg-stone.jpg` with a light calming layer on top (see Design system). No other section backgrounds.
- **Tech stack (keep it beginner-friendly, no build step):** plain HTML + CSS + JavaScript ES modules. Libraries loaded from the jsDelivr or gstatic CDN at pinned versions. The site runs with the VS Code **Live Server** extension. Firebase for real accounts and data. MediaPipe for try-on.
- Clean, commented code. Small files with clear names. No frameworks unless she asks.
- Fully responsive (desktop, tablet, phone). Respect `prefers-reduced-motion`. Accessible: real `<button>`/`<a>`, alt text, focus states, keyboard support for menus and modals.
- English site copy (brand voice: elegant, short, confident). Prices in **SAR**, two decimals.

---

## 1. Folder structure

```
/ (the "makeup" folder)
├── index.html            Home
├── collection.html       One collection page (?c=lips|face|eyes|brows&type=...)
├── product.html          One product page (?id=...)
├── try-on.html           Virtual try-on
├── account.html          My account (profile + orders), protected
├── checkout.html         Checkout, protected
├── css/
│   ├── base.css          Variables, reset, typography, background
│   ├── components.css    Buttons, tiles, chips, modals, drawer, dropdowns
│   └── pages.css         Page-specific styles
├── js/
│   ├── firebase-config.js   Firebase keys (she will paste them)
│   ├── auth.js              Sign up / sign in / Google / sign out / auth state
│   ├── cart.js              Bag logic (Firestore when signed in)
│   ├── products.js          Product catalog data
│   ├── header.js            Shared offers bar + navbar + bag drawer + login modal
│   ├── home.js  collection.js  product.js  checkout.js  account.js
│   └── tryon/
│       ├── tryon.js         Page logic, shade picker, sources (camera/photo/model)
│       └── makeup.js        Drawing lips, liner, blush, concealer on landmarks
└── assets/images/        All images (already provided)
```

Shared parts (offers bar, navbar, footer, bag drawer, login modal) are injected by `header.js` on every page so they are written once.

---

## 2. Design system

**Background (locked):**
```css
body {
  background-color: #EDE2D6;
  background-image: linear-gradient(rgba(245,238,230,.4), rgba(245,238,230,.4)), url(../assets/images/bg-stone.jpg);
  background-size: cover; background-position: center; background-attachment: fixed;
}
```
On phones, `background-attachment: scroll`. Panels, modals and dropdowns use the same image with a stronger layer `rgba(250,244,237,.72)`. Sections are separated by `1px solid rgba(87,36,43,.15)` and spacing, never by colored backgrounds.

**Colors (CSS variables):**
- `--burgundy #57242B` (text, buttons) · `--burgundy-dark #3F161D` (hover)
- `--text-2 #6B3A3A` · `--label #7A4848`
- `--cream-text #F2E0C3` (text on burgundy)
- `--gold #CFA06D` (tiny accents only: bag count, offer separators)
- `--lip-red #A40018` · `--lip-red-light #C80B27` · `--lip-red-deep #7F020A`
- `--line rgba(87,36,43,.15)` · `--shadow 0 18px 36px rgba(60,25,30,.2)`

**Fonts (Google Fonts):** Playfair Display (500, 700, 800, italic 500) for headings and the logo; Manrope (400, 500, 600) for everything else. Logo: `NEVERTI`, Playfair 700, letter-spacing .3em. Small labels: 12px, uppercase, letter-spacing .2–.4em, color `--label`. Section titles: Playfair 500, `clamp(40px, 5vw, 72px)`, one word in italic.

**Buttons:** pill shape (radius 999px), 1px burgundy border, Manrope 12px uppercase, letter-spacing .18em, padding 10px 18px, hover fills burgundy with cream text. Primary = filled burgundy. Each header button has a small line icon (inline SVG icon is fine for UI icons only).

**Product tile:** square photo (object-fit: contain on white-ish `rgba(255,255,255,.6)` with a thin border), name (14px), price, full-width outlined "Add to bag" button that fills on hover, small "Try on" link for try-on-able products. Hover: tile lifts 6px.

**Motion:** ease `cubic-bezier(.2,.7,.2,1)`, durations .4–.9s. Marquees are slow (40–60s per loop) and pause on hover.

---

## 3. Shared header (every page)

1. **Offers bar:** burgundy strip, cream text, slow infinite marquee, gold diamond separators. Messages: "Up to 22% off 3D Plumping Gloss", "10% off Brow Up Mascara", "11% off Soft Tint", "New Matte Couture shades just landed".
2. **Navbar** (sticky on scroll, same stone background):
   - Left: logo → home.
   - `Collections ▾` — mega dropdown (hover and click, keyboard accessible): 4 columns, each with its 16:9 collection photo, the collection name in Playfair, then its product types as links (`collection.html?c=lips&type=Gloss`).
   - `New ▾` — New arrivals, Best sellers, The red edit (anchors on home).
   - `Our story ▾` — About Neverti, Inspired by Nefertiti, Contact us.
   - **Try on** — filled burgundy button with a small sparkle icon → `try-on.html`.
   - Right: **Search** (opens an overlay that searches product names live), **Sign in** (or **My account** + **Sign out** when signed in), **Bag** with a gold count circle → opens the bag drawer.
   - Phone: everything collapses into a menu button that opens a full-screen menu.
3. **Bag drawer** (right side): items with photo, name, shade, price, quantity − / +, remove; subtotal; "Checkout" button.
4. **Login modal** (see section 7).

---

## 4. Home page (`index.html`), top to bottom

1. **Hero:** small label "Inspired by Nefertiti", the word **NEVERTI** in Playfair 800 caps filled with `lipstick-texture.jpg` (`background-clip: text`), revealed left-to-right with a soft moving mask over ~2.6s. Under it: "Elegance and strength in every shade." and two buttons: "Shop new arrivals" and "Try on". Right side: the four collection photos stacked like pages (Lips in front, then Face, Eyes, Brows behind), each slightly offset and rotated (−3° to 2.5°), lifting on hover; clicking a page opens that collection.
2. **New arrivals** (`#new`): title "New *arrivals*", two horizontal rows of product tiles moving in opposite directions (lips on top, face below), pause on hover.
3. **Shop by collection:** 4 tall cards (4:5) with the collection photo (`object-position: 35% 50%`), name and product count; image zooms slightly on hover.
4. **Best sellers** (`#best`): grid of 8 products with star rating.
5. **Try-on invitation:** model photo on the left, "See it *before* you buy it", short text, button to `try-on.html`.
6. **The red edit** (`#red`): `collection-lips.jpg` full width (16:7), text on the cream right side: "Liner, matte, *gloss.*" + "Shop lips" → Lips, Liquid lipstick.
7. **Our story** (`#story`): centered Playfair quote: "Named after Queen Nefertiti, a timeless symbol of *beauty and strength.*" and one supporting paragraph.
8. **Footer** (`#contact`): logo + tagline, Shop links, Help links (Shipping, Returns, FAQ — simple sections on one page are fine), Contact placeholders `[email]`, `[WhatsApp]`, `Instagram [@handle]`, Newsletter email field that saves the email to Firestore `newsletter` collection and shows "You're on the list."

---

## 5. Collection page (`collection.html?c=...&type=...`)

- Page-transition effect: on arrival, three blank paper pages are "thrown" in from the top-right one after another (rotate 24° → settle at −4°, 3°, −1.5°), then the main page lands on top (0°) and its content fades in. Total under 1.3s.
- Main page: the collection photo as a wide banner (16:6) with "COLLECTION 0X" and the name on the cream area at the right.
- Filter chips: All + the collection's types (active chip filled). Sort select: Featured, Price low–high, Price high–low, New.
- Product count + large grid of product tiles. URL updates with the chosen filter.
- Collections and types: Lips (Liquid lipstick, Gloss, Lip oil) · Face (Concealer, Foundation, Blush, Contour & glow) · Eyes (Mascara, Eyeliner) · Brows (Pomade, Brow mascara, Pencil & wax).

## 6. Product page (`product.html?id=...`)

Large product photo, name, price, short description, **shade picker** (round swatches with names; choosing one updates the selected shade), quantity, "Add to bag", "Try this shade" (opens `try-on.html?product=...&shade=...` with it selected), and a "You may also like" row from the same collection.

---

## 7. Real accounts — Firebase Authentication

Guide her step by step (in Arabic) to:
1. Create a free Firebase project at console.firebase.google.com.
2. Add a **Web app** and copy the config into `js/firebase-config.js`.
3. Enable **Authentication → Email/Password** and **Google**.
4. Create a **Cloud Firestore** database (production mode) and paste the security rules below.
5. Add `localhost` and `127.0.0.1` to Authentication → Settings → Authorized domains (usually already there).

Use the Firebase modular SDK from the gstatic CDN (pinned version).

**Behavior:**
- Browsing never requires an account.
- Pressing **Add to bag** while signed out opens the login modal with the line "Sign in to add **[product]** to your bag". After a successful sign-in or sign-up, the item is added automatically and the modal closes.
- Login modal tabs: **Sign in** (email, password, "Forgot password?" → `sendPasswordResetEmail`) and **Create account** (name, email, password, confirm). Plus "Continue with Google". Friendly error messages (wrong password, email already used, weak password).
- When signed in the header shows **My account** and **Sign out**. `account.html` and `checkout.html` redirect to home + open the modal when signed out.
- Save a user profile doc on sign-up: `users/{uid}` → `{ name, email, createdAt }`.

**Firestore structure:**
```
users/{uid}                      { name, email, createdAt }
users/{uid}/cart/{itemId}        { productId, shade, qty, addedAt }
users/{uid}/orders/{orderId}     { items[], subtotal, address{}, status:"Placed", createdAt }
newsletter/{autoId}              { email, createdAt }
```

**Security rules:**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /newsletter/{id} {
      allow create: if request.resource.data.email is string;
    }
  }
}
```

## 8. Bag and checkout

- The bag lives in Firestore for signed-in users and updates live (`onSnapshot`), so it is the same on every device.
- `checkout.html`: shipping form (full name, phone, city, address), order summary, total. "Place order" saves the order to `users/{uid}/orders`, empties the bag, and shows a confirmation with the order number. **No real payment** — show a clear note "Payment is not connected in this demo."
- `account.html`: name and email, order history list (date, items, total, status), sign out.

---

## 9. Virtual try-on (`try-on.html`) — MediaPipe, free

Read `.claude/skills/neverti-brand/references/try-on.md` first.

- Library: `@mediapipe/tasks-vision` `FaceLandmarker` (pinned version, model file from Google's storage), GPU delegate with CPU fallback.
- **Three sources** (tabs): **Camera** (live, `VIDEO` mode, mirrored), **Upload a photo** (selfie, `IMAGE` mode), **Our model** (`assets/images/model.png`, `IMAGE` mode). Default to "Our model" so it works without permission.
- **Products:** tabs Lips, Eyeliner, Blush, Concealer. Each shade = `{ name, hex, finish }`; finishes: `matte`, `gloss`, `tint`. Use the shades in `products.js`.
- **Realism requirements:** build a mask from the landmark polygons (outer lips minus inner mouth; upper lash line for liner as a tapered stroke with a small wing; soft ellipses on cheek apples for blush; under-eye crescent for concealer). Feather the mask edges, color with `multiply`/`soft-light` so real texture and light remain, gloss adds a highlight taken from the image's bright areas, tint uses lower opacity. Liner must follow the lash line exactly and be thin.
- Products stack (lips + liner + blush + concealer together). An intensity slider per product. A "Before / After" hold-to-compare button. "Now wearing" list and **"Add this look to bag"**.
- Privacy line on the page: "Everything happens on your device. No photo is uploaded."
- Camera needs HTTPS or localhost; explain this to her.

---

## 10. Product data (`js/products.js`)

Use `.claude/skills/neverti-brand/references/products.md` as the source. Each product:
```js
{ id: "matte-couture-tango-red", name: "Matte Couture", shade: "Tango Red", hex: "#B81E2C",
  finish: "matte", type: "Liquid lipstick", collection: "lips", price: 26.45,
  image: "assets/images/products/matte-couture-tango-red.jpg", isNew: true, rating: 5.0 }
```
Product photos are not in the folder yet: show an elegant placeholder tile ("Product photo") until she adds images to `assets/images/products/` with matching names. Hex values are approximate; leave a comment that they should be sampled from the real swatches.

---

## 11. Images provided in `assets/images/`

- `bg-stone.jpg` — the site background (locked)
- `lipstick-texture.jpg` — fills the NEVERTI hero word
- `collection-lips.jpg`, `collection-eyes.jpg`, `collection-brows.jpg` — approved collection photos (cream space on the right for text)
- `collection-face-TEMP.jpg` — temporary; a new Face photo will replace it
- `model.png` — bare-face model for the try-on
- `lipstick-red.png` — transparent lipstick cut-out (optional, never animate it sliding around)

---

## 12. Build order (stop for approval after each)

1. Folder structure, `base.css`, `components.css`, shared header/footer with offers bar and navbar dropdowns (no Firebase yet).
2. Home page, all sections.
3. Collection page with thrown-pages transition, filters, sort; product page.
4. Firebase setup with her, then real sign up / sign in / Google / reset password / sign out and the login-gated "Add to bag".
5. Bag in Firestore, checkout, account page with orders.
6. Try-on: model photo first, then upload, then camera.
7. Polish: phone layout, keyboard and screen-reader checks, loading states, empty states, image sizes.
8. Deploy with **Firebase Hosting** (free HTTPS, needed for the camera) and add the live domain to Firebase authorized domains. Walk her through every command.

At the end of each phase, tell her in Arabic: what you built, how to open it (Live Server), what to click to test it, and what comes next.
