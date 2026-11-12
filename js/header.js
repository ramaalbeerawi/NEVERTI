// =========================================================
// NEVERTI — header.js
// Writes the shared parts ONCE and injects them into every page:
//   offers bar · navbar (with dropdowns) · phone menu · search ·
//   bag drawer · login modal · footer
//
// Every page only needs:
//   <div id="site-header"></div>  ...page content...  <div id="site-footer"></div>
//   <script type="module" src="js/header.js"></script>
// =========================================================

import {
  LINES, COLLECTIONS, MAIN_COLLECTIONS, MORE_COLLECTIONS,
  formatPrice, discountPercent, defaultShade, getShade,
} from "./products.js";
import { productUrl } from "./product-tile.js";
import { subscribeNewsletter, friendlyError } from "./auth.js";
import { initAccountUI } from "./account-ui.js";

// ---------- Content ----------
// Offers come from the real store prices: the 4 biggest discounts right now
const OFFERS = LINES.map((line) => ({
  line,
  off: Math.max(...line.shades.map(discountPercent)),
}))
  .filter((o) => o.off >= 5)
  .sort((a, b) => b.off - a.off)
  .slice(0, 4)
  .map(({ line, off }) => `Up to ${off}% off ${line.name}`);

const NEW_LINKS = [
  { label: "New arrivals", href: "index.html#new" },
  { label: "Best sellers", href: "index.html#best" },
  { label: "Daily deals", href: "collection.html?c=deals" },
  { label: "The red edit", href: "index.html#red" },
];

const STORY_LINKS = [
  { label: "About Neverti", href: "index.html#story" },
  { label: "Inspired by Nefertiti", href: "index.html#nefertiti" },
  { label: "Contact us", href: "index.html#contact" },
];

// ---------- Small line icons (UI only — never for products) ----------
const svg = (paths) =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;

const ICON = {
  chevron: svg(`<path d="m7 10 5 5 5-5"/>`),
  search: svg(`<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>`),
  user: svg(`<circle cx="12" cy="8.5" r="3.8"/><path d="M4.8 20c1.3-3.5 4-5.3 7.2-5.3s5.9 1.8 7.2 5.3"/>`),
  bag: svg(`<path d="M5.5 8.5h13l-1 11.5h-11z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>`),
  sparkle: svg(`<path d="M12 3.5c.6 4.3 2.2 5.9 6.5 6.5-4.3.6-5.9 2.2-6.5 6.5-.6-4.3-2.2-5.9-6.5-6.5 4.3-.6 5.9-2.2 6.5-6.5z"/>`),
  menu: svg(`<path d="M4 8h16M4 16h16"/>`),
  close: svg(`<path d="m6 6 12 12M18 6 6 18"/>`),
};

// A photo slot: shows a calm placeholder if the image file is missing
const photo = (src, label = "Photo") =>
  `<span class="img-slot" data-label="${label}"><img src="${src}" alt="" loading="lazy"></span>`;

const typeLink = (c, t) => `collection.html?c=${c.id}&amp;type=${encodeURIComponent(t)}`;

// =========================================================
// 1) TEMPLATES (plain HTML strings)
// =========================================================

function offersBarHTML() {
  // The list is written twice so the marquee can loop without a gap
  const items = [...OFFERS, ...OFFERS].map((o) => `<li>${o}</li>`).join("");
  return `
  <div class="offers" role="region" aria-label="Current offers">
    <div class="offers__track">
      <ul class="offers__list">${items}</ul>
      <ul class="offers__list" aria-hidden="true">${items}</ul>
    </div>
  </div>`;
}

function megaMenuHTML() {
  const cols = MAIN_COLLECTIONS.map(
    (c) => `
    <div class="mega__col">
      <a class="mega__photo" href="collection.html?c=${c.id}" tabindex="-1" aria-hidden="true">
        ${photo(c.image, "Collection photo")}
      </a>
      <a class="mega__title" href="collection.html?c=${c.id}">${c.name}</a>
      <ul class="mega__types">
        ${c.types.map((t) => `<li><a href="${typeLink(c, t)}">${t}</a></li>`).join("")}
      </ul>
    </div>`
  ).join("");
  // Collections without a photo: a quiet text column
  const more = `
    <div class="mega__col mega__more">
      <p class="label">More</p>
      <ul>
        ${MORE_COLLECTIONS.map((c) => `<li><a href="collection.html?c=${c.id}">${c.name}</a></li>`).join("")}
        <li><a href="collection.html?c=deals">Daily deals</a></li>
      </ul>
    </div>`;
  return `<div class="mega stone-panel" id="menu-collections" data-panel><div class="mega__grid container">${cols}${more}</div></div>`;
}

function smallMenuHTML(id, links) {
  return `
  <div class="dropdown stone-panel" id="${id}" data-panel>
    <ul>${links.map((l) => `<li><a href="${l.href}">${l.label}</a></li>`).join("")}</ul>
  </div>`;
}

function navbarHTML() {
  return `
  <header class="navbar" id="navbar">
    <div class="navbar__inner container">
      ${document.body.dataset.page === "home" ? "" : '<a class="logo" href="index.html" aria-label="Neverti home">NEVERTI</a>'}

      <nav class="nav" aria-label="Main">
        <ul class="nav__list">
          <li class="nav__item nav__item--mega" data-dropdown>
            <button class="nav__link" type="button" aria-expanded="false" aria-controls="menu-collections" data-dropdown-toggle>
              Collections ${ICON.chevron}
            </button>
            ${megaMenuHTML()}
          </li>
          <li class="nav__item" data-dropdown>
            <button class="nav__link" type="button" aria-expanded="false" aria-controls="menu-new" data-dropdown-toggle>
              New ${ICON.chevron}
            </button>
            ${smallMenuHTML("menu-new", NEW_LINKS)}
          </li>
          <li class="nav__item" data-dropdown>
            <button class="nav__link" type="button" aria-expanded="false" aria-controls="menu-story" data-dropdown-toggle>
              Our story ${ICON.chevron}
            </button>
            ${smallMenuHTML("menu-story", STORY_LINKS)}
          </li>
          <li class="nav__item">
            <a class="nav__link" href="shade-match.html">Find my shade</a>
          </li>
          <li class="nav__item">
            <a class="btn btn--primary" href="try-on.html">${ICON.sparkle} Try on</a>
          </li>
        </ul>
      </nav>

      <div class="navbar__actions">
        <button class="btn btn--icon navbar__desktop-only" type="button" data-open="search-dialog" aria-label="Search">${ICON.search}</button>
        <button class="btn navbar__desktop-only" type="button" data-open="login-dialog" data-auth-out>${ICON.user} Sign in</button>
        <a class="btn navbar__desktop-only" href="account.html" data-auth-in hidden>${ICON.user} <span data-user-name>My account</span></a>
        <button class="btn navbar__desktop-only" type="button" data-signout data-auth-in hidden>Sign out</button>
        <button class="btn bag-btn" type="button" data-open="bag-dialog" aria-label="Bag, 0 items">
          ${ICON.bag}<span class="bag-btn__text">Bag</span><span class="bag-count" data-bag-count>0</span>
        </button>
        <button class="btn btn--icon menu-btn" type="button" data-open="menu-dialog" aria-label="Open menu">${ICON.menu}</button>
      </div>
    </div>
  </header>`;
}

function phoneMenuHTML() {
  const collections = COLLECTIONS.map(
    (c) => `
      <li>
        <a class="phone-menu__collection" href="collection.html?c=${c.id}">${c.name}</a>
        <ul class="phone-menu__types">
          ${c.types.map((t) => `<li><a href="${typeLink(c, t)}">${t}</a></li>`).join("")}
        </ul>
      </li>`
  ).join("");
  const list = (links) => links.map((l) => `<li><a href="${l.href}">${l.label}</a></li>`).join("");

  return `
  <dialog class="phone-menu stone-panel" id="menu-dialog" aria-label="Menu">
    <div class="phone-menu__inner">
      <div class="phone-menu__top">
        <a class="logo" href="index.html">NEVERTI</a>
        <button class="btn btn--icon" type="button" data-close aria-label="Close menu">${ICON.close}</button>
      </div>

      <div class="phone-menu__quick">
        <a class="btn btn--primary" href="try-on.html">${ICON.sparkle} Try on</a>
        <a class="btn" href="shade-match.html">Find my shade</a>
      </div>

      <details class="phone-menu__group" open>
        <summary>Collections ${ICON.chevron}</summary>
        <ul>${collections}</ul>
      </details>
      <details class="phone-menu__group">
        <summary>New ${ICON.chevron}</summary>
        <ul>${list(NEW_LINKS)}</ul>
      </details>
      <details class="phone-menu__group">
        <summary>Our story ${ICON.chevron}</summary>
        <ul>${list(STORY_LINKS)}</ul>
      </details>

      <div class="phone-menu__actions">
        <button class="btn" type="button" data-open="search-dialog">${ICON.search} Search</button>
        <button class="btn" type="button" data-open="login-dialog" data-auth-out>${ICON.user} Sign in</button>
        <a class="btn" href="account.html" data-auth-in hidden>${ICON.user} My account</a>
        <button class="btn" type="button" data-signout data-auth-in hidden>Sign out</button>
      </div>
    </div>
  </dialog>`;
}

function searchHTML() {
  return `
  <dialog class="search stone-panel" id="search-dialog" aria-label="Search products">
    <div class="search__inner container">
      <div class="search__bar">
        ${ICON.search}
        <label class="visually-hidden" for="search-input">Search products</label>
        <input id="search-input" type="search" placeholder="Search a product or shade" autocomplete="off">
        <button class="btn btn--icon" type="button" data-close aria-label="Close search">${ICON.close}</button>
      </div>
      <p class="search__hint" id="search-hint">Try “Matte Couture”, “Gloss” or “Tango Red”.</p>
      <ul class="search__results" id="search-results" aria-live="polite"></ul>
    </div>
  </dialog>`;
}

function bagHTML() {
  return `
  <dialog class="drawer stone-panel" id="bag-dialog" aria-labelledby="bag-title">
    <div class="drawer__inner">
      <div class="drawer__head">
        <h2 id="bag-title">Your bag</h2>
        <button class="btn btn--icon" type="button" data-close aria-label="Close bag">${ICON.close}</button>
      </div>

      <div class="drawer__body" id="bag-items">
        <div class="empty">
          <p>Your bag is empty.</p>
          <a class="btn" href="index.html#new" data-close>Shop new arrivals</a>
        </div>
      </div>

      <div class="drawer__foot">
        <div class="drawer__total"><span>Subtotal</span><span id="bag-subtotal">${formatPrice(0)}</span></div>
        <a class="btn btn--primary btn--block is-disabled" href="checkout.html" aria-disabled="true" tabindex="-1">Checkout</a>
      </div>
    </div>
  </dialog>`;
}

function loginHTML() {
  return `
  <dialog class="modal stone-panel" id="login-dialog" aria-labelledby="login-title">
    <div class="modal__inner">
      <button class="btn btn--icon modal__close" type="button" data-close aria-label="Close">${ICON.close}</button>
      <h2 class="modal__title" id="login-title">Welcome to Neverti</h2>
      <p class="modal__reason" id="login-reason" hidden></p>

      <div class="tabs" role="tablist" aria-label="Account">
        <button class="tab" type="button" role="tab" id="tab-signin" aria-controls="panel-signin" aria-selected="true">Sign in</button>
        <button class="tab" type="button" role="tab" id="tab-signup" aria-controls="panel-signup" aria-selected="false" tabindex="-1">Create account</button>
      </div>

      <form class="form" id="panel-signin" role="tabpanel" aria-labelledby="tab-signin" data-auth-form="signin" novalidate>
        <label class="field"><span>Email</span><input type="email" name="email" autocomplete="email" required></label>
        <label class="field"><span>Password</span><input type="password" name="password" autocomplete="current-password" required></label>
        <button class="link-btn" type="button" data-forgot>Forgot password?</button>
        <button class="btn btn--primary btn--block" type="submit">Sign in</button>
      </form>

      <form class="form" id="panel-signup" role="tabpanel" aria-labelledby="tab-signup" data-auth-form="signup" hidden novalidate>
        <label class="field"><span>Name</span><input type="text" name="name" autocomplete="name" required></label>
        <label class="field"><span>Email</span><input type="email" name="email" autocomplete="email" required></label>
        <label class="field"><span>Password</span><input type="password" name="password" autocomplete="new-password" minlength="6" required></label>
        <label class="field"><span>Confirm password</span><input type="password" name="confirm" autocomplete="new-password" required></label>
        <button class="btn btn--primary btn--block" type="submit">Create account</button>
      </form>

      <div class="modal__or"><span>or</span></div>
      <button class="btn btn--block" type="button" data-google>Continue with Google</button>
      <p class="form__message" id="login-message" role="status"></p>
      <p class="modal__note" id="login-note" hidden></p>
    </div>
  </dialog>`;
}

function footerHTML() {
  const shop = [...MAIN_COLLECTIONS, MORE_COLLECTIONS[0]]
    .map((c) => `<li><a href="collection.html?c=${c.id}">${c.name}</a></li>`)
    .join("");
  return `
  <footer class="footer" id="contact">
    <div class="footer__grid container">
      <div class="footer__brand">
        <a class="logo" href="index.html">NEVERTI</a>
        <p>Elegance and strength in every shade.</p>
      </div>

      <nav class="footer__col" aria-label="Shop">
        <h2 class="label">Shop</h2>
        <ul>${shop}<li><a href="try-on.html">Try on</a></li></ul>
      </nav>

      <nav class="footer__col" aria-label="Help">
        <h2 class="label">Help</h2>
        <ul>
          <li><a href="index.html#shipping">Shipping</a></li>
          <li><a href="index.html#returns">Returns</a></li>
          <li><a href="index.html#faq">FAQ</a></li>
        </ul>
      </nav>

      <div class="footer__col">
        <h2 class="label">Contact</h2>
        <ul>
          <li>[email]</li>
          <li>[WhatsApp]</li>
          <li>Instagram [@handle]</li>
        </ul>
      </div>

      <form class="footer__news" id="newsletter-form" novalidate>
        <h2 class="label">Newsletter</h2>
        <p>New shades and offers, first.</p>
        <div class="footer__news-row">
          <label class="visually-hidden" for="newsletter-email">Email address</label>
          <input id="newsletter-email" type="email" name="email" placeholder="Your email" autocomplete="email" required>
          <button class="btn btn--primary" type="submit">Join</button>
        </div>
        <p class="form__message" id="newsletter-message" role="status"></p>
      </form>
    </div>

    <div class="footer__base container">
      <p>© ${new Date().getFullYear()} Neverti. A portfolio concept.</p>
    </div>
  </footer>`;
}

// =========================================================
// 2) INJECT INTO THE PAGE
// =========================================================
function mount() {
  // Browser-tab icon (the brand initial, not a product drawing)
  if (!document.querySelector('link[rel~="icon"]')) {
    document.head.insertAdjacentHTML("beforeend", '<link rel="icon" type="image/svg+xml" href="assets/favicon.svg">');
  }
  // Header goes straight into <body> (not inside a wrapper) so "sticky" works
  const headerSlot = document.getElementById("site-header");
  if (headerSlot) {
    headerSlot.insertAdjacentHTML(
      "beforebegin",
      `<a class="skip-link" href="#main">Skip to content</a>${offersBarHTML()}${navbarHTML()}`
    );
    headerSlot.remove();
  }

  const footerSlot = document.getElementById("site-footer");
  if (footerSlot) {
    footerSlot.insertAdjacentHTML("beforebegin", footerHTML());
    footerSlot.remove();
  }

  // Dialogs live at the end of <body>
  document.body.insertAdjacentHTML(
    "beforeend",
    phoneMenuHTML() + searchHTML() + bagHTML() + loginHTML()
  );
}

// =========================================================
// 3) BEHAVIOR
// =========================================================
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- Dropdowns (hover + click + keyboard) ----------
function initDropdowns() {
  const items = [...document.querySelectorAll("[data-dropdown]")];
  const canHover = matchMedia("(hover: hover) and (pointer: fine)").matches;

  const setOpen = (item, open) => {
    item.classList.toggle("is-open", open);
    item.querySelector("[data-dropdown-toggle]").setAttribute("aria-expanded", String(open));
    if (!open) delete item.dataset.via;
  };
  const openOnly = (item, via) => {
    items.forEach((other) => other !== item && setOpen(other, false));
    setOpen(item, true);
    item.dataset.via = via;
  };

  items.forEach((item) => {
    const toggle = item.querySelector("[data-dropdown-toggle]");
    let leaveTimer;

    // Click: toggle. (If hover already opened it, a click just keeps it open.)
    toggle.addEventListener("click", () => {
      const isOpen = item.classList.contains("is-open");
      if (isOpen && item.dataset.via !== "hover") setOpen(item, false);
      else openOnly(item, "click");
    });

    // Hover (mouse only)
    if (canHover) {
      item.addEventListener("mouseenter", () => {
        clearTimeout(leaveTimer);
        if (!item.classList.contains("is-open")) openOnly(item, "hover");
      });
      item.addEventListener("mouseleave", () => {
        leaveTimer = setTimeout(() => setOpen(item, false), 180);
      });
    }

    // Keyboard: Escape closes, Arrow Down jumps into the menu
    item.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && item.classList.contains("is-open")) {
        setOpen(item, false);
        toggle.focus();
      }
      if (e.key === "ArrowDown" && e.target === toggle) {
        e.preventDefault();
        openOnly(item, "click");
        item.querySelector("[data-panel] a:not([tabindex='-1'])")?.focus();
      }
    });

    // Close when keyboard focus leaves the menu
    item.addEventListener("focusout", (e) => {
      if (!item.contains(e.relatedTarget)) setOpen(item, false);
    });
  });

  // Click anywhere else closes
  document.addEventListener("click", (e) => {
    items.forEach((item) => !item.contains(e.target) && setOpen(item, false));
  });
}

// ---------- Dialogs (search, bag, login, phone menu) ----------
export function openDialog(id) {
  const dialog = document.getElementById(id);
  if (!dialog || dialog.open) return;
  // Only one dialog at a time
  document.querySelectorAll("dialog[open]").forEach((d) => d.close());
  dialog.classList.remove("is-closing");
  dialog.showModal();
  document.documentElement.classList.add("has-dialog");
  dialog.dispatchEvent(new Event("dialog:open"));
}

export function closeDialog(dialog) {
  if (!dialog?.open) return;
  dialog.classList.add("is-closing");
  setTimeout(() => {
    dialog.close();
    dialog.classList.remove("is-closing");
    if (!document.querySelector("dialog[open]")) {
      document.documentElement.classList.remove("has-dialog");
    }
  }, reducedMotion() ? 0 : 320);
}

function initDialogs() {
  document.addEventListener("click", (e) => {
    const opener = e.target.closest("[data-open]");
    if (opener) {
      e.preventDefault();
      openDialog(opener.dataset.open);
      return;
    }
    const closer = e.target.closest("[data-close]");
    if (closer) {
      // Links with data-close still navigate; we just close the dialog first
      if (closer.tagName !== "A") e.preventDefault();
      closeDialog(closer.closest("dialog"));
    }
  });

  document.querySelectorAll("dialog").forEach((dialog) => {
    // Escape key: use our animated close
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      closeDialog(dialog);
    });
    // Click on the dark backdrop closes
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) closeDialog(dialog);
    });
  });
}

// ---------- Search (live, by product name / shade / type) ----------
function initSearch() {
  const dialog = document.getElementById("search-dialog");
  const input = document.getElementById("search-input");
  const results = document.getElementById("search-results");
  const hint = document.getElementById("search-hint");

  dialog.addEventListener("dialog:open", () => {
    input.value = "";
    results.innerHTML = "";
    hint.hidden = false;
    input.focus();
  });

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    hint.hidden = Boolean(q);
    if (!q) {
      results.innerHTML = "";
      return;
    }

    // A product matches by its name or type; a shade matches by its own name
    const matches = [];
    for (const line of LINES) {
      const lineHit = `${line.name} ${line.type}`.toLowerCase().includes(q);
      const shadeHits = line.shades.filter((s) => s.name?.toLowerCase().includes(q));
      if (lineHit) matches.push({ line, shade: defaultShade(line), showShade: false });
      else shadeHits.forEach((shade) => matches.push({ line, shade, showShade: true }));
    }

    if (!matches.length) {
      results.innerHTML = `<li class="search__empty"></li>`;
      results.firstChild.textContent = `Nothing matches “${input.value.trim()}”. Try a product type, like Lipstick.`;
      return;
    }

    results.innerHTML = matches
      .slice(0, 8)
      .map(
        ({ line, shade, showShade }) => `
        <li>
          <a class="search__result" href="${productUrl(line, showShade ? shade : null)}">
            <img class="search__thumb" src="${shade.image}" alt="" width="56" height="56" loading="lazy">
            <span class="search__name">${line.name}${showShade ? ` <span>${shade.name}</span>` : ""}</span>
            <span class="search__price">${formatPrice(shade.price)}</span>
          </a>
        </li>`
      )
      .join("");
  });
}

// ---------- Login modal tabs (Firebase connects in phase 4) ----------
function initLoginModal() {
  const tabs = [...document.querySelectorAll("#login-dialog [role='tab']")];
  const message = document.getElementById("login-message");

  const select = (tab) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
    });
    message.textContent = "";
  };

  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => select(tab));
    // Arrow keys move between tabs
    tab.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const next = tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
      select(next);
      next.focus();
    });
  });

  // The forms themselves (sign in, create account, Google, reset) are wired in account-ui.js
}

// ---------- Login modal with a reason ("Sign in to add … to your bag") ----------
export function openLogin(reason = "") {
  const reasonEl = document.getElementById("login-reason");
  reasonEl.textContent = reason;
  reasonEl.hidden = !reason;
  openDialog("login-dialog");
}

// ---------- Newsletter (saved to Firestore, or to this browser in demo mode) ----------
function initNewsletter() {
  const form = document.getElementById("newsletter-form");
  const message = document.getElementById("newsletter-message");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    if (!form.email.checkValidity() || !email) {
      message.textContent = "Enter a full email address, like name@example.com.";
      return;
    }
    message.textContent = "Saving…";
    try {
      await subscribeNewsletter(email);
      message.textContent = "You're on the list.";
      form.reset();
    } catch (err) {
      message.textContent = friendlyError(err);
    }
  });
}

// ---------- Navbar gets a line + shadow once it sticks ----------
function initStickyNavbar() {
  const navbar = document.getElementById("navbar");
  const offers = document.querySelector(".offers");
  const update = () => navbar.classList.toggle("is-stuck", window.scrollY > (offers?.offsetHeight || 0));
  update();
  window.addEventListener("scroll", update, { passive: true });
}

// ---------- Missing photos show a calm placeholder ----------
export function initImageFallbacks(root = document) {
  root.querySelectorAll(".img-slot img").forEach((img) => {
    const fail = () => img.closest(".img-slot").classList.add("is-missing");
    if (img.complete && img.naturalWidth === 0 && img.getAttribute("src")) fail();
    else img.addEventListener("error", fail, { once: true });
  });
}

// =========================================================
// 4) START
// =========================================================
mount();
initDropdowns();
initDialogs();
initSearch();
initLoginModal();
initAccountUI({ openDialog, closeDialog, openLogin });
initNewsletter();
initStickyNavbar();
initImageFallbacks();
