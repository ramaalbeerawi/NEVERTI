// =========================================================
// tools/test_final.mjs — FINAL_UPDATE_PROMPT.md sections 2 and 3 in a real browser
// finish data, finish + undertone filters, badges, product page, try-on hint, lab rows,
// Shade Match calibration on the model photo.
// Run: node tools/test_final.mjs
// =========================================================

import { startServer, launch, openPage, BASE } from "./check_pages.mjs";

const server = await startServer();
const browser = await launch();
const results = [];
const check = (name, ok, extra = "") => { results.push(ok); console.log(`${ok ? "✓" : "✗"} ${name}${extra ? "  → " + extra : ""}`); };

const { page, context, problems } = await openPage(browser, "index.html", { width: 1440, height: 900 });
await page.waitForTimeout(1500);

// ---- 1. Data: every try-on product is complete ----
const audit = await page.evaluate(async () => {
  const { LINES } = await import("/js/products-data.js");
  const { MATERIALS } = await import("/js/tryon/materials.js");
  const tryable = LINES.filter((l) => l.material);
  const missing = tryable.filter((l) => !l.finish || !l.texture || !l.coverage || !l.finishLabel || !l.finishEvidence || !MATERIALS[l.material]).map((l) => l.id);
  const needsTone = tryable.filter((l) => /lipstick|tint|balm|gloss|oil|blush|foundation|bb-cream|concealer|corrector/.test(l.material) && l.material !== "lip-liner");
  const noTone = needsTone.flatMap((l) => l.shades.filter((s) => s.hex && !s.undertone).map((s) => s.id));
  const nonBrush = LINES.filter((l) => l.collection !== "brushes" && !l.finish).map((l) => l.id);
  return { tryable: tryable.length, missing, noTone, nonBrush };
});
check("every try-on product has finish, texture, coverage, label, evidence and a known material", audit.missing.length === 0, `${audit.tryable} products; missing: ${audit.missing.join(", ") || "none"}`);
check("every lip, blush, foundation, concealer and corrector shade has an undertone", audit.noTone.length === 0, audit.noTone.slice(0, 5).join(", "));
check("every non-brush product has a finish", audit.nonBrush.length === 0, audit.nonBrush.join(", "));

// ---- 2. Collection page: finish + undertone chips ----
await page.goto(BASE + "collection.html?c=lips");
await page.waitForSelector("#finish-chips .chip");
const finishes = await page.$$eval("#finish-chips .chip", (els) => els.map((e) => e.textContent.trim()));
check("lips show finish chips", ["Matte", "Cream", "Tint", "Gloss", "Oil"].every((f) => finishes.includes(f)), finishes.join(" | "));
const before = await page.locator(".tile").count();
await page.click('#finish-chips [data-finish="Matte"]');
const metas = await page.$$eval(".tile__meta", (els) => els.map((e) => e.textContent.trim()));
check("the Matte chip shows only matte products", metas.length > 0 && metas.length < before && metas.every((m) => m.startsWith("Matte")), metas.join(" | "));
check("the URL follows the finish filter", page.url().includes("finish=Matte"));
await page.click('#finish-chips [data-finish="All"]');
await page.click('#undertone-chips [data-undertone="warm"]');
const warmCount = await page.locator(".tile").count();
check("the undertone chip filters products", warmCount > 0 && warmCount < before, `${warmCount} of ${before}`);
check("no 'My undertone' chip before a skin profile exists", (await page.locator('[data-undertone="mine"]').count()) === 0);
await page.screenshot({ path: ".tmp/shots/final-collection.png", fullPage: false });

await page.goto(BASE + "collection.html?c=face&type=Blush");
await page.waitForSelector("#finish-chips .chip");
const blushFinishes = await page.$$eval("#finish-chips .chip", (els) => els.map((e) => e.textContent.trim()));
check("blush shows its finishes (cream, liquid, glowy)", ["Cream", "Liquid", "Glowy"].every((f) => blushFinishes.includes(f)), blushFinishes.join(" | "));

// ---- 3. Product page: finish facts and undertone tag ----
await page.goto(BASE + "product.html?id=matte-couture-liquid-lipstick&shade=matte-couture-liquid-lipstick-tango-red");
await page.waitForSelector(".facts");
check("the product page shows what the product is", /Matte · Liquid · Full coverage/.test(await page.textContent(".facts")), (await page.textContent(".facts")).trim());
check("the shade shows its undertone", /Cool|Neutral|Warm/.test(await page.textContent("#shade-label")), (await page.textContent("#shade-label")).trim());

// ---- 4. With a saved skin profile: badges, "My undertone", hints ----
await page.evaluate(() => localStorage.setItem("neverti.skinProfile", JSON.stringify({ depthLabel: "Light", undertone: "cool", confidence: "High", picks: [] })));
await page.reload();
await page.waitForSelector("#shade-label .hint");
check("the product page gives an undertone hint", /your undertone/.test(await page.textContent("#shade-label .hint")), (await page.textContent("#shade-label .hint")).trim());
await page.goto(BASE + "collection.html?c=lips");
await page.waitForSelector('[data-undertone="mine"]');
check("a 'My undertone' chip appears", /My undertone \(cool\)/.test(await page.textContent('[data-undertone="mine"]')));
const badges = await page.locator(".tile__fit:not([hidden])").count();
check("cards say they have shades for her undertone", badges > 0, `${badges} cards`);
await page.goto(BASE + "index.html");
await page.waitForTimeout(1200);
check("home cards show the badge too", (await page.locator(".tile__fit:not([hidden])").count()) > 0);

// ---- 5. Try-on: undertone on the shade card + hint ----
await page.goto(BASE + "try-on.html?product=matte-couture-liquid-lipstick&shade=matte-couture-liquid-lipstick-chiffon");
await page.waitForFunction(() => document.getElementById("status").hidden, null, { timeout: 90000 });
const card = await page.textContent("#shade-card");
check("the try-on shade card shows the undertone and the hint", /(Cool|Neutral|Warm)/.test(card) && /your undertone/.test(card), card.replace(/\s+/g, " ").slice(0, 120));
await page.screenshot({ path: ".tmp/shots/final-tryon-card.png", clip: { x: 800, y: 300, width: 640, height: 600 } });

// ---- 6. Shade Match on the model photo: calibration numbers ----
await page.goto(BASE + "shade-match.html");
await page.waitForSelector("#result:not([hidden])", { timeout: 90000 });
const skin = { depth: (await page.textContent("#skin-depth")).trim(), under: (await page.textContent("#skin-under")).trim(), conf: (await page.textContent("#skin-confidence")).trim() };
check("Shade Match reads the model: depth, undertone and confidence", /skin/.test(skin.depth) && /undertone/.test(skin.under) && /Confidence/.test(skin.conf), `${skin.depth} · ${skin.under} · ${skin.conf}`);
const kinds = await page.$$eval(".pick__kind", (els) => els.map((e) => e.textContent.trim()));
check("it says 'closest match', never 'exact'", kinds.some((k) => /closest match/.test(k)) && !/exact match/i.test(await page.textContent("#result")));
await page.screenshot({ path: ".tmp/shots/final-match.png", fullPage: true });

check("no console errors", problems.length === 0, problems.join(" | "));
await context.close();
await browser.close();
server.close();
console.log(results.every(Boolean) ? "\nALL PASSED" : "\nSOME FAILED");
