// =========================================================
// tools/make_model_web.mjs
// Makes assets/images/model-web.jpg: a light copy of model.png (900 px wide)
// for pages that only SHOW the model (the home page). The try-on keeps using
// the full-size model.png so the makeup stays sharp.
// It uses the browser's own image tools, so nothing needs to be installed.
// Run: node tools/make_model_web.mjs
// =========================================================

import { startServer, launch, openPage } from "./check_pages.mjs";
import { writeFile } from "node:fs/promises";

const server = await startServer();
const browser = await launch();
const { page, context } = await openPage(browser, "index.html");
const dataUrl = await page.evaluate(async () => {
  const img = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = "/assets/images/model.png"; });
  const c = document.createElement("canvas");
  c.width = 900;
  c.height = Math.round((900 * img.naturalHeight) / img.naturalWidth);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.86);
});
const bytes = Buffer.from(dataUrl.split(",")[1], "base64");
await writeFile("assets/images/model-web.jpg", bytes);
console.log(`assets/images/model-web.jpg  ${(bytes.length / 1024).toFixed(0)} KB`);
await context.close();
await browser.close();
server.close();
