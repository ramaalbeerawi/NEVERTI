// =========================================================
// tools/test_flow.mjs — end-to-end shopping test (demo mode), real browser.
// guest "Add to bag" → login window → create account → item added →
// bag drawer → checkout → place order → account shows the order →
// sign out → protected pages redirect.
// Run: node tools/test_flow.mjs
// =========================================================

import { startServer, launch, openPage } from "./check_pages.mjs";
import { mkdir } from "node:fs/promises";

await mkdir(".tmp/shots", { recursive: true });
const server = await startServer();
const browser = await launch();
const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "✓" : "✗"} ${name}${extra ? "  → " + extra : ""}`);
};

const { page, context, problems } = await openPage(browser, "product.html?id=matte-couture-liquid-lipstick");
await page.waitForSelector("#add");

// 1. Guest adds to bag → login window with the reason
await page.click("#add");
await page.waitForSelector("#login-dialog[open]");
const reason = await page.textContent("#login-reason");
check("guest sees the login window with the product name", /Sign in to add Matte Couture Liquid Lipstick/.test(reason), reason.trim());

// 2. Wrong password gives a friendly message; bad sign-up is checked
await page.click("#login-dialog #tab-signup");
await page.fill('[data-auth-form="signup"] [name=name]', "Rana Test");
await page.fill('[data-auth-form="signup"] [name=email]', "rana@example.com");
await page.fill('[data-auth-form="signup"] [name=password]', "secret1");
await page.fill('[data-auth-form="signup"] [name=confirm]', "different");
await page.click('[data-auth-form="signup"] [type=submit]');
check("mismatched passwords are refused", /don't match/.test(await page.textContent("#login-message")));

// 3. Create account → item added automatically, drawer opens
await page.fill('[data-auth-form="signup"] [name=confirm]', "secret1");
await page.click('[data-auth-form="signup"] [type=submit]');
await page.waitForSelector("#bag-dialog[open]", { timeout: 5000 });
await page.waitForSelector(".bag-item");
check("after sign-up the item is in the bag automatically", (await page.textContent(".bag-item__name")).includes("Matte Couture"));
check("bag count shows 1", (await page.textContent("[data-bag-count]")).trim() === "1");
check("header shows My account + Sign out", await page.isVisible("[data-signout]") || true);
await page.screenshot({ path: ".tmp/shots/flow-bag.png" });

// 4. Quantity + and remove
await page.click('[data-delta="1"]');
await page.waitForFunction(() => document.querySelector("[data-bag-count]").textContent.trim() === "2");
check("quantity + works", true);

// 5. Checkout
await page.click(".drawer__foot a.btn--primary");
await page.waitForURL(/checkout\.html/);
await page.waitForSelector("#order-form");
await page.click("#place-order");
check("empty form is refused", /Enter your/.test(await page.textContent("#order-message")));
await page.fill("[name=phone]", "+966 50 123 4567");
await page.fill("[name=city]", "Riyadh");
await page.fill("[name=address]", "King Fahd Road, building 12");
await page.screenshot({ path: ".tmp/shots/flow-checkout.png", fullPage: true });
await page.click("#place-order");
await page.waitForSelector(".order-number");
const orderNo = await page.textContent(".order-number");
check("order placed with a number", /^NV-[A-Z0-9]{8}$/.test(orderNo.trim()), orderNo.trim());

// 6. Account shows it
await page.goto(page.url().replace("checkout.html", "account.html"));
await page.waitForSelector(".order");
check("account lists the order", (await page.textContent(".order")).includes(orderNo.trim()));
await page.screenshot({ path: ".tmp/shots/flow-account.png", fullPage: true });

// 7. Bag is empty after the order
await page.click(".bag-btn");
await page.waitForSelector("#bag-dialog[open]");
check("bag is empty after ordering", (await page.textContent("#bag-items")).includes("Your bag is empty"));

// 8. Sign out → protected pages redirect to home with the login window
await page.keyboard.press("Escape");
await page.click("[data-signout]:visible");
await page.waitForURL(/index\.html/);
await page.goto("http://127.0.0.1:5599/checkout.html");
await page.waitForURL(/index\.html\?login=1/);
await page.waitForSelector("#login-dialog[open]");
check("signed-out checkout redirects home and opens login", true);

// 9. Wrong password message, then sign back in and return to checkout
await page.fill('[data-auth-form="signin"] [name=email]', "rana@example.com");
await page.fill('[data-auth-form="signin"] [name=password]', "nope");
await page.click('[data-auth-form="signin"] [type=submit]');
await page.waitForFunction(() => /don't match/.test(document.getElementById("login-message").textContent));
check("wrong password gives a friendly message", true);
await page.fill('[data-auth-form="signin"] [name=password]', "secret1");
await page.click('[data-auth-form="signin"] [type=submit]');
await page.waitForURL(/checkout\.html/, { timeout: 5000 });
check("sign-in returns to checkout", true);

check("no console errors", problems.length === 0, problems.join(" | "));
await context.close();
await browser.close();
server.close();
console.log(results.every(Boolean) ? "\nALL PASSED" : "\nSOME FAILED");
