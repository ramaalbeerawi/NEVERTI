// =========================================================
// tools/test_match.mjs — "Find my shade" in a real browser.
// Run: node tools/test_match.mjs
// =========================================================

import { chromium } from "playwright-core";
import { startServer, BASE } from "./check_pages.mjs";

const server = await startServer();
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const problems = [];
page.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("INFO:")) problems.push(m.text()); });
page.on("pageerror", (e) => problems.push("pageerror: " + e.message));

const results = [];
const check = (name, ok, extra = "") => { results.push(ok); console.log(`${ok ? "✓" : "✗"} ${name}${extra ? "  → " + extra : ""}`); };

await page.goto(BASE + "shade-match.html");
await page.waitForSelector("#result:not([hidden])", { timeout: 90000 });
const depth = (await page.textContent("#skin-depth")).trim();
const under = (await page.textContent("#skin-under")).trim();
check("the model's skin is measured", /skin$/.test(depth) && /undertone/.test(under), `${depth} · ${under}`);
const picks = await page.locator(".pick").count();
check("foundation, concealer, blush and lipstick are suggested", picks >= 6, `${picks} picks`);
const kinds = await page.$$eval(".pick__kind", (els) => els.map((e) => e.textContent.trim()));
check("each kind is there", ["Foundation", "Concealer", "Blush", "Lipstick"].every((k) => kinds.some((x) => x.startsWith(k))), kinds.join(" | "));
await page.screenshot({ path: ".tmp/shots/match.png", fullPage: true });

// Adjust by hand: deeper skin changes the label and the picks
const firstPick = await page.textContent(".pick__shade");
await page.locator("#adj-depth").fill("-12");
await page.waitForTimeout(300);
const deeper = (await page.textContent("#skin-depth")).trim();
const deepPick = await page.textContent(".pick__shade");
check("sliders change the skin and the suggested shade", deeper !== depth && deepPick !== firstPick, `${depth} → ${deeper}; ${firstPick.trim()} → ${deepPick.trim()}`);
await page.locator("#adj-depth").fill("0");

// Tap a spot on the photo
const box = await page.locator("#canvas").boundingBox();
await page.mouse.click(box.x + box.width * 0.42, box.y + box.height * 0.5);
await page.waitForTimeout(400);
check("tapping a spot measures that spot", (await page.locator("#skin-depth").textContent()).length > 0);

// Guest: Add to bag → login; Save → login
await page.locator("[data-add-to-bag]").first().click();
await page.waitForSelector("#login-dialog[open]");
check("Add to bag asks a guest to sign in", true);
await page.click("#login-dialog #tab-signup");
await page.fill('[data-auth-form="signup"] [name=name]', "Mona");
await page.fill('[data-auth-form="signup"] [name=email]', "mona@example.com");
await page.fill('[data-auth-form="signup"] [name=password]', "secret1");
await page.fill('[data-auth-form="signup"] [name=confirm]', "secret1");
await page.click('[data-auth-form="signup"] [type=submit]');
await page.waitForSelector("#bag-dialog[open]");
await page.waitForSelector(".bag-item");
check("signing up adds the pick to the bag", true);
await page.keyboard.press("Escape");
await page.waitForTimeout(500);

// Save to account, then see it in My account
await page.click("#save");
await page.waitForFunction(() => /Saved/.test(document.getElementById("save-message").textContent));
check("the shade is saved to the account", true);
await page.goto(BASE + "account.html");
await page.waitForSelector("#shade-card:not([hidden])");
check("My account shows the saved shade match", (await page.textContent("#shade-body")).includes("undertone"));

// Try the picks on
await page.goto(BASE + "shade-match.html");
await page.waitForSelector("#result:not([hidden])", { timeout: 90000 });
await page.click("#try-picks");
await page.waitForURL(/try-on\.html/);
await page.waitForFunction(() => document.getElementById("status").hidden, null, { timeout: 90000 });
const worn = await page.locator(".wearing__item").count();
check("Try my picks on opens the try-on already wearing them", worn >= 3, `${worn} products`);

check("no console errors", problems.length === 0, problems.join(" | "));
await browser.close();
server.close();
console.log(results.every(Boolean) ? "\nALL PASSED" : "\nSOME FAILED");
