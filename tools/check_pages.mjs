// =========================================================
// tools/check_pages.mjs — test the site in a real browser (Microsoft Edge)
//
// Opens each page at desktop and phone size, waits for it to settle,
// saves a full-page screenshot to .tmp/shots/ and prints every console
// error, page error and failed request.
//
// Run from the project folder:
//   node tools/check_pages.mjs                 (all pages)
//   node tools/check_pages.mjs index product   (only these)
// Options: --desktop / --phone (one size only), --wait=3000
// =========================================================

import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const PORT = 5599;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json", ".webp": "image/webp",
};

export const PAGES = {
  index: "index.html",
  collection: "collection.html?c=lips",
  product: "product.html?id=matte-couture-liquid-lipstick",
  tryon: "try-on.html",
  lab: "try-on-lab.html",
  match: "shade-match.html",
  checkout: "checkout.html",
  account: "account.html",
};

// Tiny static server for the project folder
export function startServer() {
  const server = createServer(async (req, res) => {
    try {
      const path = normalize(join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname)));
      if (!path.startsWith(ROOT)) throw new Error("outside");
      const body = await readFile(path);
      res.writeHead(200, { "Content-Type": TYPES[extname(path)] || "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404).end("not found");
    }
  });
  return new Promise((ok) => server.listen(PORT, () => ok(server)));
}

export const launch = () => chromium.launch({ channel: "msedge", headless: true });
export const BASE = `http://127.0.0.1:${PORT}/`;

// Open one page and collect problems
export async function openPage(browser, url, { width = 1440, height = 900, mobile = false } = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    isMobile: mobile,
    hasTouch: mobile,
    permissions: [],
  });
  const page = await context.newPage();
  const problems = [];
  page.on("console", (m) => {
    // MediaPipe prints normal "INFO:" notices on the error channel; ignore them
    if (m.type() === "error" && !m.text().startsWith("INFO:")) problems.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("requestfailed", (r) => {
    // Downloads cancelled by leaving the page are normal
    if (r.failure()?.errorText !== "net::ERR_ABORTED") problems.push(`failed: ${r.url()} (${r.failure()?.errorText})`);
  });
  page.on("response", (r) => { if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`); });
  await page.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 90000 });
  return { page, context, problems };
}

// ---------- CLI ----------
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const names = args.filter((a) => !a.startsWith("--"));
  const waitArg = args.find((a) => a.startsWith("--wait="));
  const wait = waitArg ? Number(waitArg.split("=")[1]) : 2500;
  const sizes = [];
  if (!args.includes("--phone")) sizes.push({ tag: "desktop", width: 1440, height: 900 });
  if (!args.includes("--desktop")) sizes.push({ tag: "phone", width: 390, height: 844, mobile: true });

  await mkdir(".tmp/shots", { recursive: true });
  const server = await startServer();
  const browser = await launch();
  let total = 0;
  for (const name of names.length ? names : Object.keys(PAGES)) {
    for (const size of sizes) {
      const { page, context, problems } = await openPage(browser, PAGES[name] || name, size);
      await page.waitForTimeout(wait);
      // Scroll down in steps so lazy-loaded images load, then back to the top
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(600);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 1) problems.push(`horizontal overflow: ${overflow}px`);
      const file = `.tmp/shots/${name}-${size.tag}.png`;
      await page.screenshot({ path: file, fullPage: true });
      console.log(`${problems.length ? "✗" : "✓"} ${name} (${size.tag}) → ${file}`);
      problems.forEach((p) => console.log("    " + p));
      total += problems.length;
      await context.close();
    }
  }
  await browser.close();
  server.close();
  console.log(total ? `${total} problem(s)` : "No problems found");
}
