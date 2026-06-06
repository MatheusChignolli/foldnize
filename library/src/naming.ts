import path from "node:path";
import fs from "node:fs";

export enum Mode {
  PREFIX = "prefix",
  REPLACE = "replace",
  CUSTOM = "custom",
}

export interface DateParts {
  year: string;
  month: string;
  day: string;
  hour: string | null;
  minute: string | null;
  second: string | null;
}

export const VALID_EXTENSIONS: ReadonlySet<string> = new Set([
  ".mov",
  ".mp3",
  ".mp4",
  ".jpg",
  ".jpeg",
  ".png",
]);

/** Sorted extensions for display, e.g. `.jpeg`, `.jpg`, `.mov`, … */
export function formatSupportedExtensions(): string {
  return [...VALID_EXTENSIONS].sort().join(", ");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function sanitizeCustomName(rawName: unknown): string {
  if (typeof rawName !== "string") return "";

  return rawName
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.\-\s]+|[.\-\s]+$/g, "");
}

function buildPrefixName(oldName: string, dateParts: DateParts): string {
  const date = `${dateParts.year}${dateParts.month}${dateParts.day}`;
  return `${date}-${oldName}`;
}

function buildReplaceName(oldName: string, dateParts: DateParts): string {
  const ext = path.extname(oldName);
  const timestamp =
    `${dateParts.year}${dateParts.month}${dateParts.day}` +
    `-${dateParts.hour}${dateParts.minute}${dateParts.second}`;

  return `${timestamp}${ext}`;
}

function buildCustomName(
  oldName: string,
  dateParts: DateParts,
  customName: string,
): string {
  const ext = path.extname(oldName);
  const timestamp =
    `${dateParts.year}${dateParts.month}${dateParts.day}` +
    `-${dateParts.hour}${dateParts.minute}${dateParts.second}`;

  return `${customName}-${timestamp}${ext}`;
}

export function buildNewName(
  oldName: string,
  mode: Mode,
  dateParts: DateParts,
  customName?: string,
): string {
  if (mode === Mode.REPLACE) return buildReplaceName(oldName, dateParts);
  if (mode === Mode.CUSTOM) {
    return buildCustomName(oldName, dateParts, customName ?? "");
  }
  return buildPrefixName(oldName, dateParts);
}

function isAlreadyPrefixed(fileName: string): boolean {
  const parsed = path.parse(fileName);
  return /^\d{8}-.+$/i.test(parsed.name);
}

function isAlreadyReplaced(fileName: string): boolean {
  const parsed = path.parse(fileName);
  return /^\d{8}-\d{6}(?:-\d+)?$/i.test(parsed.name);
}

function isAlreadyCustom(fileName: string, customName: string): boolean {
  const parsed = path.parse(fileName);
  const pattern = new RegExp(
    `^${escapeRegex(customName)}-\\d{8}-\\d{6}(?:-\\d+)?$`,
    "i",
  );
  return pattern.test(parsed.name);
}

export function shouldSkipAlreadyFormatted(
  oldName: string,
  mode: Mode,
  customName?: string,
): boolean {
  if (mode === Mode.REPLACE) return isAlreadyReplaced(oldName);
  if (mode === Mode.CUSTOM) return isAlreadyCustom(oldName, customName ?? "");
  return isAlreadyPrefixed(oldName);
}

export function ensureUniquePath(targetPath: string): string {
  if (!fs.existsSync(targetPath)) return targetPath;

  const dir = path.dirname(targetPath);
  const parsed = path.parse(targetPath);
  let counter = 1;

  while (true) {
    const candidate = path.join(dir, `${parsed.name}-${counter}${parsed.ext}`);
    if (!fs.existsSync(candidate)) return candidate;
    counter += 1;
  }
}
