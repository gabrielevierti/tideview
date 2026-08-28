/**
 * Renders every screen, in both surface styles, against a sailing fixture and a
 * moored one, and asserts the things a screenshot cannot show you:
 *
 *   - nothing throws
 *   - ink stays under Glyph's budget (every lit pixel is a pixel of the sea you
 *     cannot see through)
 *   - no text is drawn too close in level to what sits behind it
 *   - nothing lands in the margin a badly-fitted waveguide clips
 *
 *   npm test
 */
import { createServer } from "vite";
import { chromium } from "playwright";

const server = await createServer({ server: { port: 5197 }, logLevel: "silent" });
await server.listen();

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));

await page.goto("http://localhost:5197/tools/check.html");
await page.waitForFunction("window.__done === true", null, { timeout: 60000 });

const results = await page.evaluate("window.__results");
const budget = await page.evaluate("window.__budget");

const failures = [];
console.log("screen        fixture   surface    ink    lit   contrast  bleed");
for (const r of results) {
  const bad = r.threw || r.ink > budget || r.contrast.length > 0 || r.bleed > 0;
  console.log(
    `${r.screen.padEnd(13)} ${r.fixture.padEnd(9)} ${r.surface.padEnd(9)} ` +
    `${(r.ink * 100).toFixed(1)}%  ${(r.lit * 100).toFixed(0).padStart(3)}%  ` +
    `${String(r.contrast.length).padStart(6)}  ${String(r.bleed).padStart(6)}${bad ? "   ←" : ""}`
  );
  if (r.threw) failures.push(`${r.screen}/${r.fixture}/${r.surface} threw: ${r.threw}`);
  if (r.ink > budget) failures.push(`${r.screen}/${r.surface} ink ${(r.ink * 100).toFixed(1)}% over budget ${(budget * 100).toFixed(0)}%`);
  for (const warning of r.contrast) failures.push(`${r.screen}/${r.surface} low contrast: ${warning}`);
  if (r.bleed > 0) failures.push(`${r.screen}/${r.surface} ${r.bleed} lit pixels outside the safe area`);
}

for (const error of errors) failures.push(`page error: ${error}`);

await browser.close();
await server.close();

if (failures.length) {
  console.log(`\n${failures.length} problem(s):`);
  for (const failure of failures) console.log(`  ${failure}`);
  process.exit(1);
}
console.log("\nall screens within budget");
