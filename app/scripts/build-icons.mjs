// Compiles assets/Foldnize.icon (Icon Composer bundle) into icon.icns + icon.png.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, "..", "assets");
const iconBundle = path.join(assetsDir, "Foldnize.icon");
const iconPath = path.join(assetsDir, "icon.png");
const icnsPath = path.join(assetsDir, "icon.icns");
const assetsCarPath = path.join(assetsDir, "Assets.car");

if (!fs.existsSync(iconBundle)) {
  console.error("[icons] missing assets/Foldnize.icon — add your Icon Composer bundle there");
  process.exit(1);
}

function findActool() {
  const candidates = [
    "/Applications/Xcode.app/Contents/Developer/usr/bin/actool",
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  try {
    return execSync("xcrun --find actool", { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function readSourcePngFromIconBundle() {
  const iconJson = JSON.parse(
    fs.readFileSync(path.join(iconBundle, "icon.json"), "utf8"),
  );
  const imageName = iconJson.groups?.[0]?.layers?.[0]?.["image-name"];
  if (!imageName) {
    throw new Error("[icons] could not read image-name from Foldnize.icon/icon.json");
  }

  const pngPath = path.join(iconBundle, "Assets", imageName);
  if (!fs.existsSync(pngPath)) {
    throw new Error(`[icons] missing asset in Foldnize.icon: Assets/${imageName}`);
  }

  return pngPath;
}

function resize(input, output, size) {
  execSync(`sips -z ${size} ${size} "${input}" --out "${output}"`, {
    stdio: "inherit",
  });
}

function buildIcnsFromPng(source) {
  const iconset = path.join(assetsDir, "icon.iconset");
  fs.rmSync(iconset, { recursive: true, force: true });
  fs.mkdirSync(iconset);

  const sizes = [
    ["icon_16x16.png", 16],
    ["icon_16x16@2x.png", 32],
    ["icon_32x32.png", 32],
    ["icon_32x32@2x.png", 64],
    ["icon_128x128.png", 128],
    ["icon_128x128@2x.png", 256],
    ["icon_256x256.png", 256],
    ["icon_256x256@2x.png", 512],
    ["icon_512x512.png", 512],
  ];

  for (const [name, size] of sizes) {
    resize(source, path.join(iconset, name), size);
  }

  fs.copyFileSync(source, path.join(iconset, "icon_512x512@2x.png"));
  execSync(`iconutil -c icns "${iconset}" -o "${icnsPath}"`, { stdio: "inherit" });
  fs.rmSync(iconset, { recursive: true, force: true });
}

function compileWithActool(actool) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "foldnize-icon-"));

  try {
    execSync(
      [
        `"${actool}"`,
        `"${iconBundle}"`,
        `--compile "${outDir}"`,
        "--app-icon Foldnize",
        "--platform macosx",
        "--target-device mac",
        "--minimum-deployment-target 11.0",
        "--output-partial-info-plist /dev/null",
      ].join(" "),
      { stdio: "inherit" },
    );

    const producedIcns = path.join(outDir, "Foldnize.icns");
    if (!fs.existsSync(producedIcns)) {
      throw new Error("[icons] actool did not produce Foldnize.icns");
    }

    fs.copyFileSync(producedIcns, icnsPath);

    const producedCar = path.join(outDir, "Assets.car");
    if (fs.existsSync(producedCar)) {
      fs.copyFileSync(producedCar, assetsCarPath);
      console.log(`[icons] ${path.relative(path.join(__dirname, ".."), assetsCarPath)}`);
    }
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
}

if (process.platform !== "darwin") {
  const source = readSourcePngFromIconBundle();
  fs.copyFileSync(source, iconPath);
  console.log(`[icons] ${path.relative(path.join(__dirname, ".."), iconPath)} (from Foldnize.icon)`);
  process.exit(0);
}

const actool = findActool();
if (actool) {
  try {
    compileWithActool(actool);
    console.log(`[icons] ${path.relative(path.join(__dirname, ".."), icnsPath)} (via actool + Foldnize.icon)`);
  } catch (error) {
    console.warn("[icons] actool failed, falling back to iconutil:", error.message);
    buildIcnsFromPng(readSourcePngFromIconBundle());
    console.log(`[icons] ${path.relative(path.join(__dirname, ".."), icnsPath)} (via iconutil + Foldnize.icon)`);
  }
} else {
  buildIcnsFromPng(readSourcePngFromIconBundle());
  console.log(`[icons] ${path.relative(path.join(__dirname, ".."), icnsPath)} (via iconutil + Foldnize.icon)`);
}

const source = readSourcePngFromIconBundle();
resize(source, iconPath, 512);
console.log(`[icons] ${path.relative(path.join(__dirname, ".."), iconPath)} (from Foldnize.icon)`);
