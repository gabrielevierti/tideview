/**
 * Renders every screen to docs/screens/*.png and composes docs/screens.png.
 *
 *   npm run snapshot
 *
 * Look at the diff after a visual change. With a committed font atlas these
 * PNGs are reproducible on a machine other than the one that made them.
 */
import { createServer } from "vite";
import { chromium } from "playwright";
import fs from "node:fs";

const server = await createServer({ server: { port: 5199 }, logLevel: "silent" });
await server.listen();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } });
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));

await page.goto("http://localhost:5199/tools/snapshot.html");
await page.waitForFunction("window.__done === true", null, { timeout: 60000 });

const shots = await page.evaluate("window.__shots");
fs.mkdirSync("docs/screens", { recursive: true });
for (const [name, dataUrl] of Object.entries(shots)) {
  fs.writeFileSync(`docs/screens/${name}.png`, Buffer.from(dataUrl.split(",")[1], "base64"));
}
const sheet = await page.evaluate("window.__sheet");
fs.writeFileSync("docs/screens.png", Buffer.from(sheet.split(",")[1], "base64"));

const faces = await page.evaluate("window.__font");
console.log(`wrote ${Object.keys(shots).length} screens + docs/screens.png`);
console.log(faces
  ? `text rendered from ${faces} bitmap faces — these PNGs are reproducible anywhere`
  : "text rendered by this host's font stack — run `npm run font` to pin it");

if (errors.length) {
  console.log("\npage errors:");
  for (const error of errors) console.log(`  ${error}`);
}

await browser.close();
await server.close();
process.exit(errors.length ? 1 : 0);
