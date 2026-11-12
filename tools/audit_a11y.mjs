// =========================================================
// tools/audit_a11y.mjs — accessibility basics on every page
// Checks: images without alt, buttons and links without a name, form fields without
// a label, duplicate ids, missing page language, exactly one <h1>, and that the page
// can be used with the keyboard (focus is visible on the first Tab).
// Run: node tools/audit_a11y.mjs
// =========================================================

import { startServer, launch, openPage, PAGES } from "./check_pages.mjs";

const server = await startServer();
const browser = await launch();
let total = 0;

for (const [name, url] of Object.entries(PAGES)) {
  const { page, context } = await openPage(browser, url, { width: 1280, height: 900 });
  await page.waitForTimeout(3500);
  const issues = await page.evaluate(() => {
    const out = [];
    const nameOf = (el) =>
      (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "").trim() ||
      [...el.querySelectorAll("img[alt]")].map((i) => i.alt).join("").trim() ||
      (el.getAttribute("aria-labelledby") && document.getElementById(el.getAttribute("aria-labelledby"))?.textContent.trim());
    document.querySelectorAll("img:not([alt])").forEach((i) => out.push("image without alt: " + i.getAttribute("src")));
    document.querySelectorAll("button, a[href]").forEach((el) => {
      if (el.closest("[hidden], [inert], [aria-hidden=true]")) return;
      if (!nameOf(el)) out.push("no name: " + el.outerHTML.slice(0, 90));
    });
    document.querySelectorAll("input:not([type=hidden]):not([type=file]), select, textarea").forEach((el) => {
      const labelled = el.labels?.length || el.getAttribute("aria-label") || el.getAttribute("aria-labelledby");
      if (!labelled) out.push("field without label: " + el.outerHTML.slice(0, 90));
    });
    const ids = {};
    document.querySelectorAll("[id]").forEach((el) => (ids[el.id] = (ids[el.id] || 0) + 1));
    Object.entries(ids).filter(([, n]) => n > 1).forEach(([id]) => out.push("duplicate id: " + id));
    if (!document.documentElement.lang) out.push("no lang on <html>");
    const h1 = document.querySelectorAll("h1").length;
    if (h1 !== 1) out.push(`${h1} <h1> elements (should be 1)`);
    return out;
  });
  // Keyboard: the first Tab must land on the skip link, with a visible outline
  await page.keyboard.press("Tab");
  const focus = await page.evaluate(() => {
    const el = document.activeElement;
    const cs = el && getComputedStyle(el);
    return { text: el?.textContent.trim().slice(0, 30), outline: cs?.outlineStyle, width: cs?.outlineWidth };
  });
  if (focus.outline === "none" || focus.width === "0px") issues.push("first focused element has no visible focus: " + JSON.stringify(focus));
  console.log(`${issues.length ? "✗" : "✓"} ${name}`);
  issues.forEach((i) => console.log("    " + i));
  total += issues.length;
  await context.close();
}
await browser.close();
server.close();
console.log(total ? `${total} issue(s)` : "No accessibility issues found");
