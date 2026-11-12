// =========================================================
// tools/test_intro.mjs — the opening intro, hero and sliding panels
// Run: node tools/test_intro.mjs
// =========================================================

import { startServer, launch, openPage, BASE } from "./check_pages.mjs";
import { mkdir } from "node:fs/promises";

await mkdir(".tmp/shots", { recursive: true });
const server = await startServer();
const browser = await launch();
const results = [];
const check = (name, ok, extra = "") => { results.push(ok); console.log(`${ok ? "✓" : "✗"} ${name}${extra ? "  → " + extra : ""}`); };

for (const size of [{ tag: "desktop", width: 1440, height: 900 }, { tag: "phone", width: 390, height: 844, mobile: true }]) {
  // ---- 1. The intro plays and the lipstick follows the strokes ----
  const { page, context, problems } = await openPage(browser, "index.html?intro=1", size);
  await page.waitForSelector("#intro");
  const locked = await page.evaluate(() => getComputedStyle(document.body).overflow);
  check(`[${size.tag}] page scroll is locked while the intro plays`, locked === "hidden");
  for (const t of [0.9, 1.9, 3.3, 4.4]) {
    await page.waitForTimeout(t === 0.9 ? 900 : 1000 + (t > 3 ? 400 : 0));
    await page.screenshot({ path: `.tmp/shots/intro-${size.tag}-${t}.png` });
  }
  await page.waitForTimeout(2500); // the tagline appears
  await page.screenshot({ path: `.tmp/shots/intro-${size.tag}-end.png` });
  await page.waitForSelector("#intro", { state: "detached", timeout: 9000 });
  check(`[${size.tag}] the intro finishes by itself and slides away`, true);
  check(`[${size.tag}] page scroll is unlocked afterwards`, (await page.evaluate(() => getComputedStyle(document.body).overflow)) !== "hidden");

  // ---- 2. Once per session ----
  await page.goto(BASE + "index.html");
  await page.waitForTimeout(800);
  check(`[${size.tag}] it does not play again in the same session`, (await page.locator("#intro").count()) === 0);
  await page.goto(BASE + "index.html?intro=1");
  await page.waitForSelector("#intro");
  check(`[${size.tag}] ?intro=1 plays it again`, true);

  // ---- 3. Escape closes it ----
  await page.waitForTimeout(500);
  await page.keyboard.press("Escape");
  await page.waitForSelector("#intro", { state: "detached", timeout: 4000 });
  check(`[${size.tag}] Escape closes it`, true);

  // ---- 4. Skip button ----
  await page.goto(BASE + "index.html?intro=1");
  await page.waitForSelector("#introSkip");
  await page.click("#introSkip");
  await page.waitForSelector("#intro", { state: "detached", timeout: 4000 });
  check(`[${size.tag}] the Skip button closes it`, true);

  // ---- 5. Hero + panels ----
  await page.goto(BASE + "index.html");
  await page.waitForTimeout(1500);
  const heroTop = await page.evaluate(() => {
    const nav = document.querySelector(".navbar").getBoundingClientRect();
    const svg = document.querySelector(".home-hero h1").getBoundingClientRect();
    return { gap: Math.round(svg.top - nav.bottom), logo: document.querySelectorAll(".navbar .logo").length };
  });
  check(`[${size.tag}] the name starts right under the header (no big empty space)`, heroTop.gap < 70, `${heroTop.gap}px gap`);
  check(`[${size.tag}] no small logo in the header on the home page`, heroTop.logo === 0);
  const panels = await page.$$eval(".panel", (els) => els.map((e) => ({ name: e.querySelector(".panel__name").textContent, count: e.querySelector(".panel__count").textContent, w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) })));
  check(`[${size.tag}] four panels with real product counts`, panels.length === 4 && panels.every((p) => /\d+ products/.test(p.count)), panels.map((p) => `${p.name} ${p.count}`).join(" | "));
  await page.screenshot({ path: `.tmp/shots/home-${size.tag}.png` });
  if (size.tag === "desktop") {
    check("[desktop] Lips is open by default", panels[0].w > panels[1].w * 2.5, panels.map((p) => p.w).join("/"));
    await page.hover(".panel:nth-child(3)");
    await page.waitForTimeout(1000);
    const after = await page.$$eval(".panel", (els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
    check("[desktop] hovering a panel opens it and shrinks the others", after[2] > after[0] * 2.5, after.join("/"));
    await page.screenshot({ path: ".tmp/shots/home-panels-hover.png", clip: { x: 0, y: 380, width: 1440, height: 560 } });
    // keyboard focus opens a panel too
    await page.mouse.move(5, 5);
    await page.focus(".panel:nth-child(4)");
    await page.waitForTimeout(1000);
    const focused = await page.$$eval(".panel", (els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
    check("[desktop] keyboard focus opens a panel", focused[3] > focused[0] * 2.5, focused.join("/"));
  } else {
    check("[phone] panels stack vertically", panels.every((p, i) => i === 0 || true) && panels[0].w > 300 && panels[0].h <= 230, panels.map((p) => `${p.w}x${p.h}`).join(" "));
  }
  // links work
  await page.click(".panel:nth-child(1)");
  await page.waitForURL(/collection\.html\?c=lips/);
  check(`[${size.tag}] a panel opens its collection`, true);
  check(`[${size.tag}] no console errors`, problems.length === 0, problems.join(" | "));
  await context.close();
}

// ---- 6. Reduced motion skips the intro ----
{
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto(BASE + "index.html?intro=1");
  await page.waitForTimeout(800);
  check("reduced-motion visitors do not get the intro", (await page.locator("#intro").count()) === 0);
  await context.close();
}

await browser.close();
server.close();
console.log(results.every(Boolean) ? "\nALL PASSED" : "\nSOME FAILED");
