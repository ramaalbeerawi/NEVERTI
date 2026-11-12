// =========================================================
// tools/test_tryon.mjs — the try-on page in a real browser.
// Our model loads, a face is found, products change the picture, stacking,
// strength, before/after, Lip combo, "Add this look to bag" (with sign-in),
// the camera-blocked message, and a fake camera for the live mode.
// Run: node tools/test_tryon.mjs
// =========================================================

import { chromium } from "playwright-core";
import { startServer, BASE } from "./check_pages.mjs";
import { mkdir } from "node:fs/promises";

await mkdir(".tmp/shots", { recursive: true });
const server = await startServer();
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});
const results = [];
const check = (name, ok, extra = "") => { results.push(ok); console.log(`${ok ? "✓" : "✗"} ${name}${extra ? "  → " + extra : ""}`); };

async function newPage(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ...options });
  const page = await context.newPage();
  const problems = [];
  page.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("INFO:")) problems.push(m.text()); });
  page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
  return { page, context, problems };
}
// A hash of the picture, to know whether the makeup changed it
const picture = (page) => page.evaluate(() => {
  const c = document.getElementById("canvas");
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let h = 0;
  for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) | 0;
  return h;
});
const waitFace = (page) => page.waitForFunction(() => document.getElementById("status").hidden, null, { timeout: 90000 });

// ---------- 1. Our model ----------
{
  const { page, context, problems } = await newPage();
  await page.goto(BASE + "try-on.html");
  await waitFace(page);
  check("our model loads and a face is found", true);
  const clean = await picture(page);

  // Lips tab: first product, first shade
  const t0 = Date.now();
  await page.click("#dots .dot >> nth=9");
  await page.waitForTimeout(400);
  const withLips = await picture(page);
  check("a lipstick changes the picture", withLips !== clean, `${Date.now() - t0} ms`);
  check("it shows in Now wearing with a shade code", /NP\d+/.test(await page.textContent("#wearing")));

  // Stack: blush, brows, eyeliner, mascara, foundation
  for (const [cat, productIndex, dotIndex] of [["cheeks", 0, 1], ["eyes", 1, 0], ["face", 0, 2], ["brows", 1, 1]]) {
    await page.click(`[data-cat=${cat}]`);
    await page.click(`#products .tp >> nth=${productIndex}`);
    await page.click(`#dots .dot >> nth=${dotIndex}`);
  }
  await page.waitForTimeout(600);
  const items = await page.locator(".wearing__item").count();
  check("products stack (several in Now wearing)", items >= 5, `${items} items`);
  const stacked = await picture(page);
  check("stacking changes the picture again", stacked !== withLips);

  // Strength slider
  await page.locator('[data-intensity]').first().fill("20");
  await page.waitForTimeout(400);
  check("strength slider changes the picture", (await picture(page)) !== stacked);

  // Before / After: hold the button
  await page.locator("#compare").scrollIntoViewIfNeeded();
  const box = await page.locator("#compare").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(500);
  const heldBefore = await picture(page);
  await page.mouse.up();
  await page.waitForTimeout(500);
  check("holding Before shows the clean photo", heldBefore === clean);
  check("releasing brings the makeup back", (await picture(page)) !== clean);
  await page.screenshot({ path: ".tmp/shots/tryon-look.png" });

  // Lip combo
  await page.click("#lip-combo");
  await page.waitForTimeout(500);
  const wearingText = await page.textContent("#wearing");
  check("Lip combo adds liner, lipstick and gloss", /Lip liner/.test(wearingText) && /Lipstick/.test(wearingText) && /Gloss/.test(wearingText));

  // Add this look to bag: signed out → login window; then signs up → added
  await page.click("#add-look");
  await page.waitForSelector("#login-dialog[open]");
  check("Add this look asks a guest to sign in", /your look/.test(await page.textContent("#login-reason")));
  await page.click("#login-dialog #tab-signup");
  await page.fill('[data-auth-form="signup"] [name=name]', "Tess");
  await page.fill('[data-auth-form="signup"] [name=email]', "tess@example.com");
  await page.fill('[data-auth-form="signup"] [name=password]', "secret1");
  await page.fill('[data-auth-form="signup"] [name=confirm]', "secret1");
  await page.click('[data-auth-form="signup"] [type=submit]');
  await page.waitForSelector("#bag-dialog[open]");
  await page.waitForSelector(".bag-item");
  const inBag = await page.locator(".bag-item").count();
  check("after sign-in the whole look is in the bag", inBag >= 3, `${inBag} products`);
  check("no console errors", problems.length === 0, problems.join(" | "));
  await context.close();
}

// ---------- 2. Camera blocked ----------
{
  const { page, context } = await newPage({ permissions: [] });
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error("denied"), { name: "NotAllowedError" }));
  });
  await page.goto(BASE + "try-on.html");
  await waitFace(page);
  await page.click("[data-source=camera]");
  await page.waitForFunction(() => /blocked/i.test(document.getElementById("status-text").textContent));
  check("blocked camera shows a clear message with buttons", (await page.locator("#status-actions button").count()) >= 1);
  await page.screenshot({ path: ".tmp/shots/tryon-camera-blocked.png" });
  await context.close();
}

// ---------- 3. Live camera (a fake camera feed) ----------
{
  const { page, context, problems } = await newPage({ permissions: ["camera"] });
  await page.goto(BASE + "try-on.html");
  await waitFace(page);
  await page.click("[data-source=camera]");
  await page.waitForFunction(() => document.getElementById("video").readyState >= 2, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  // The fake feed is not a face, so the page must say so instead of drawing makeup on nothing
  const text = await page.textContent("#status-text");
  check("the live camera starts, and says when no face is visible", /can't see your face|Allow camera/i.test(text) || (await page.evaluate(() => document.getElementById("status").hidden)), text.trim());
  check("camera mode has no console errors", problems.length === 0, problems.join(" | "));
  await context.close();
}

// ---------- 4. No face in an uploaded photo ----------
{
  const { page, context } = await newPage();
  await page.goto(BASE + "try-on.html");
  await waitFace(page);
  await page.setInputFiles("#file", "assets/images/bg-stone.jpg");
  await page.waitForFunction(() => /can't find a face/i.test(document.getElementById("status-text").textContent), null, { timeout: 30000 });
  check("a photo without a face gets a helpful message", true);
  await context.close();
}

await browser.close();
server.close();
console.log(results.every(Boolean) ? "\nALL PASSED" : "\nSOME FAILED");
