// Copies static files into the build output so paths inside the compiled
// main process resolve correctly (HTML/CSS next to renderer.js, icons next
// to main.js).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");

function copy(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`[copy-assets] skip missing source: ${src}`);
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
  console.log(
    `[copy-assets] ${path.relative(root, src)} → ${path.relative(root, dest)}`,
  );
}

copy(
  path.join(root, "renderer", "index.html"),
  path.join(dist, "renderer", "index.html"),
);
copy(
  path.join(root, "renderer", "styles.css"),
  path.join(dist, "renderer", "styles.css"),
);
copy(path.join(root, "assets"), path.join(dist, "assets"));
