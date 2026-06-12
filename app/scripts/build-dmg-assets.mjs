// Renders assets/dmg-background.svg → dmg-background.png (+ @2x) for electron-builder.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, "..", "assets");
const svgPath = path.join(assetsDir, "dmg-background.svg");

if (!fs.existsSync(svgPath)) {
  console.error("[dmg] missing assets/dmg-background.svg");
  process.exit(1);
}

function render(outPath, width) {
  const svg = fs.readFileSync(svgPath, "utf8");
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
  });
  fs.writeFileSync(outPath, resvg.render().asPng());
}

const png1x = path.join(assetsDir, "dmg-background.png");
const png2x = path.join(assetsDir, "dmg-background@2x.png");

render(png1x, 540);
render(png2x, 1080);

console.log(`[dmg] ${path.relative(path.join(__dirname, ".."), png1x)}`);
console.log(`[dmg] ${path.relative(path.join(__dirname, ".."), png2x)}`);
