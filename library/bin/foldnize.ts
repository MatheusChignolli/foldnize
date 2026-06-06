#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import {
  organizeFolder,
  LogLevel,
  Mode,
  formatSupportedExtensions,
  type LogEntry,
} from "../src";

function parseMode(value: string | undefined): Mode {
  switch (value) {
    case "prefix":
      return Mode.PREFIX;
    case "replace":
      return Mode.REPLACE;
    case "custom":
      return Mode.CUSTOM;
    default:
      throw new Error(
        `Invalid --mode value: "${value ?? ""}". Use --mode=prefix | replace | custom.`,
      );
  }
}

interface CliOptions {
  root: string;
  mode: Mode;
  customName?: string;
  dryRun: boolean;
  organizeIntoYearMonth: boolean;
  scanSubfolders: boolean;
  help: boolean;
  version: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// argv parsing
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(argv: readonly string[]): CliOptions {
  const args: CliOptions = {
    root: process.cwd(),
    mode: Mode.PREFIX,
    customName: undefined,
    dryRun: false,
    organizeIntoYearMonth: false,
    scanSubfolders: true,
    help: false,
    version: false,
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--version" || arg === "-v") {
      args.version = true;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--organize-year-month" || arg === "--year-month") {
      args.organizeIntoYearMonth = true;
    } else if (arg === "--no-subfolders" || arg === "--top-level") {
      args.scanSubfolders = false;
    } else if (arg.startsWith("--mode=")) {
      const rawValue = arg.split("=")[1];
      const value = rawValue?.trim().toLowerCase();
      args.mode = parseMode(value);
    } else if (arg.startsWith("--custom-name=") || arg.startsWith("--name=")) {
      const value = arg.split("=").slice(1).join("=").trim();
      if (!value) {
        throw new Error("--custom-name requires a non-empty value.");
      }
      args.customName = value;
    } else if (arg.startsWith("--root=") || arg.startsWith("--dir=")) {
      const value = arg.split("=").slice(1).join("=").trim();
      if (!value) {
        throw new Error("--root requires a non-empty value.");
      }
      args.root = path.resolve(value);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printHelp(): void {
  console.log(
    `
foldnize — Organize media files by their embedded original date.

Usage:
  foldnize [options]

Options:
  --root=PATH               Folder to scan (default: current directory)
  --mode=MODE               prefix | replace | custom        (default: prefix)
  --custom-name=NAME        Required when --mode=custom
  --year-month              Also move files into <root>/YYYY/MM/ subfolders
  --no-subfolders           Don't recurse — only top-level files
  --dry-run                 Preview changes without touching disk
  --help, -h                Show this help
  --version, -v             Show version

Modes:
  prefix    Keeps the original name, adds YYYYMMDD- in front.
  replace   Renames to YYYYMMDD-HHMMSS.ext.
  custom    Renames to {customName}-YYYYMMDD-HHMMSS.ext.

Examples:
  foldnize --root=./photos --mode=prefix --dry-run
  foldnize --root=./photos --mode=replace --year-month
  foldnize --root=./photos --mode=custom --custom-name=vacation
  foldnize --root=./photos --year-month --no-subfolders

Supported formats:
  ${formatSupportedExtensions()}

Requirements:
  • Node.js 22+
  • exiftool       (brew install exiftool)    — photos, audio, and most video metadata
  • ffprobe        (brew install ffmpeg)      — fallback for .mp4 and .mov video files

Files without parseable date metadata are silently skipped.
`.trim(),
  );
}

function readPackageVersion(): string {
  // When compiled, __dirname is .../dist/bin → ../../package.json
  // When running source via tsx, __dirname is .../bin     → ../package.json
  const candidates = [
    path.join(__dirname, "..", "..", "package.json"),
    path.join(__dirname, "..", "package.json"),
  ];

  for (const candidate of candidates) {
    try {
      const pkg = JSON.parse(fs.readFileSync(candidate, "utf8")) as {
        name?: string;
        version?: string;
      };
      if (pkg.name === "foldnize" && typeof pkg.version === "string") {
        return pkg.version;
      }
    } catch {
      // try next candidate
    }
  }

  return "unknown";
}

// ─────────────────────────────────────────────────────────────────────────────
// Pretty console logging
// ─────────────────────────────────────────────────────────────────────────────

const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  bold: "\x1b[1m",
} as const;

type ColorName = keyof typeof COLORS;

const supportsColor: boolean = Boolean(
  process.stdout.isTTY && process.env.TERM !== "dumb" && !process.env.NO_COLOR,
);

function paint(color: ColorName, text: string): string {
  if (!supportsColor) return text;
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

function logEntry({ level, message }: LogEntry): void {
  switch (level) {
    case LogLevel.INFO:
      console.log(paint("dim", message));
      break;
    case LogLevel.RENAMED:
      console.log(paint("green", "✓ ") + message);
      break;
    case LogLevel.MOVED:
      console.log(paint("cyan", "→ ") + message);
      break;
    case LogLevel.DRY:
      console.log(paint("blue", "· ") + message);
      break;
    case LogLevel.SKIP:
      console.log(paint("yellow", "↷ ") + paint("dim", message));
      break;
    case LogLevel.ERROR:
      console.error(paint("red", "✗ ") + message);
      break;
    case LogLevel.DONE:
      console.log("\n" + paint("bold", paint("green", message)));
      break;
    default: {
      const exhaustive: never = level;
      void exhaustive;
      console.log(message);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────────────────────

function main(): void {
  let options: CliOptions;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(paint("red", message));
    console.log("");
    printHelp();
    process.exit(1);
  }

  if (options.help) {
    printHelp();
    return;
  }

  if (options.version) {
    console.log(readPackageVersion());
    return;
  }

  try {
    const summary = organizeFolder({
      root: options.root,
      mode: options.mode,
      dryRun: options.dryRun,
      customName: options.customName,
      organizeIntoYearMonth: options.organizeIntoYearMonth,
      scanSubfolders: options.scanSubfolders,
      onLog: logEntry,
    });

    if (summary.found === 0) {
      console.log(paint("yellow", "No supported files found."));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(paint("red", `Error: ${message}`));
    process.exit(1);
  }
}

main();
