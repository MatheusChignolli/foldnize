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

function copyRequired(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`[copy-assets] required source is missing: ${src}`);
  }
  copy(src, dest);
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

// Windows releases are self-contained. Copy the executable into dist so it
// becomes an explicit app asset instead of relying on electron-builder to
// discover a platform-specific optional dependency.
if (process.platform === "win32") {
  copyRequired(
    path.join(root, "node_modules", "exiftool-vendored.exe", "bin"),
    path.join(dist, "metadata-tools", "exiftool"),
  );
}
