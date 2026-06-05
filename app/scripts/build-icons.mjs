// Generates assets/icon.png (512×512) from assets/icon.svg for electron-builder.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, "..", "assets");
const svgPath = path.join(assetsDir, "icon.svg");
const pngPath = path.join(assetsDir, "icon.png");

const svg = fs.readFileSync(svgPath, "utf8");
const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: 512 },
});
const png = resvg.render().asPng();

fs.writeFileSync(pngPath, png);
console.log(`[icons] ${path.relative(path.join(__dirname, ".."), pngPath)}`);
