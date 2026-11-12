// =========================================================
// tools/sample_shades.mjs
// Opens tools/sample_shades.html in headless Microsoft Edge (already on
// Windows) through a tiny local server, and saves .tmp/shade-hex.json.
// Then run build_products.mjs again to put the colors into the catalog.
//
// Run:  node tools/sample_shades.mjs
// =========================================================

import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { extname, join, normalize } from "node:path";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".jpg": "image/jpeg", ".png": "image/png" };

// Minimal static server for the project folder
const server = createServer(async (req, res) => {
  try {
    const path = normalize(join(process.cwd(), decodeURIComponent(new URL(req.url, "http://x").pathname)));
    if (!path.startsWith(process.cwd())) throw new Error("outside");
    const body = await readFile(path); // read first, so a missing file still gets a clean 404
    res.writeHead(200, { "Content-Type": TYPES[extname(path)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(5588);

execFile(
  EDGE,
  ["--headless=new", "--disable-gpu", "--virtual-time-budget=60000", "--dump-dom", "http://127.0.0.1:5588/tools/sample_shades.html"],
  { maxBuffer: 20 * 1024 * 1024 },
  async (err, stdout) => {
    server.close();
    const match = stdout.match(/RESULT(\{.*?\})<\/pre>/s);
    if (err || !match) {
      console.error("Sampling failed.", err?.message || stdout.slice(0, 300));
      process.exit(1);
    }
    const colors = JSON.parse(match[1].replace(/&quot;/g, '"'));
    await writeFile(".tmp/shade-hex.json", JSON.stringify(colors, null, 1));
    console.log(`Sampled ${Object.keys(colors).length} shades → .tmp/shade-hex.json`);
  }
);
