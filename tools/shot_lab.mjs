// Screenshots the materials lab in slices so each material can be inspected.
// Run: node tools/shot_lab.mjs [debug]
import { startServer, launch, openPage } from "./check_pages.mjs";

const debug = process.argv.includes("debug");
const server = await startServer();
const browser = await launch();
const { page, problems } = await openPage(browser, "try-on-lab.html" + (debug ? "?debug=1" : ""), { width: 1440, height: 900 });
await page.waitForSelector("body[data-ready=true]", { timeout: 240000 });

const tiles = await page.$$(".lab-tile");
const names = await page.$$eval(".lab-tile h2", (h) => h.map((x) => x.textContent));
console.log("tiles:", tiles.length);
console.log(names.map((n, i) => i + ":" + n).join(" | "));

// 6 tiles per image (2 rows of 3)
for (let s = 0; s * 6 < tiles.length; s++) {
  const boxes = [];
  for (let i = s * 6; i < Math.min(tiles.length, s * 6 + 6); i++) boxes.push(await tiles[i].boundingBox());
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const x2 = Math.max(...boxes.map((b) => b.x + b.width));
  const y2 = Math.max(...boxes.map((b) => b.y + b.height));
  const file = ".tmp/shots/lab" + (debug ? "-debug" : "") + "-" + s + ".png";
  await page.screenshot({ path: file, fullPage: true, clip: { x, y, width: x2 - x, height: y2 - y } });
}
console.log(problems.length ? problems.join("\n") : "no problems");
await browser.close();
server.close();
