// Screenshots each "Side by side" row of the materials lab.
// Run: node tools/shot_compare.mjs
import { startServer, launch, openPage } from "./check_pages.mjs";

const server = await startServer();
const browser = await launch();
const { page, problems } = await openPage(browser, "try-on-lab.html", { width: 1440, height: 900 });
await page.waitForSelector("body[data-ready=true]", { timeout: 300000 });
const rows = await page.$$(".compare-row");
for (let i = 0; i < rows.length; i++) await rows[i].screenshot({ path: ".tmp/shots/compare-" + i + ".png" });
console.log(rows.length + " rows", problems.length ? problems.join("\n") : "no problems");
await browser.close();
server.close();
