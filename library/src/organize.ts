import fs from "node:fs";
import path from "node:path";
import { walk } from "./walk";
import { getOriginalFileDateParts } from "./metadata";
import {
  buildNewName,
  shouldSkipAlreadyFormatted,
  sanitizeCustomName,
  ensureUniquePath,
  Mode,
} from "./naming";

export enum LogLevel {
  INFO = "info",
  RENAMED = "renamed",
  MOVED = "moved",
  DRY = "dry",
  SKIP = "skip",
  ERROR = "error",
  DONE = "done",
}

export interface LogEntry {
  level: LogLevel;
  message: string;
}

export type LogFn = (entry: LogEntry) => void;

export interface OrganizeOptions {
  /** Absolute path to the folder to scan. */
  root: string;
  /** Renaming strategy. Defaults to `"prefix"`. */
  mode?: Mode;
  /** Preview without touching files. Defaults to `false`. */
  dryRun?: boolean;
  /** Required when `mode === "custom"`. */
  customName?: string;
  /**
   * When `true`, each file is moved into `<root>/YYYY/MM/` based on its date.
   * Existing folders are reused; missing ones are created. Defaults to `false`.
   */
  organizeIntoYearMonth?: boolean;
  /**
   * When `false`, only files directly inside `root` are processed.
   * Defaults to `true`.
   */
  scanSubfolders?: boolean;
  /** Streamed log callback. */
  onLog?: LogFn;
}

export interface OrganizeSummary {
  found: number;
  renamed: number;
  moved: number;
  skipped: number;
}

interface ProcessResult {
  renamed: boolean;
  moved: boolean;
  skipped: boolean;
}

interface ProcessFileParams {
  filePath: string;
  root: string;
  mode: Mode;
  dryRun: boolean;
  customName: string;
  organizeIntoYearMonth: boolean;
  onLog?: LogFn;
}

function processFile({
  filePath,
  root,
  mode,
  dryRun,
  customName,
  organizeIntoYearMonth,
  onLog,
}: ProcessFileParams): ProcessResult {
  const oldName = path.basename(filePath);
  const log = (level: LogLevel, message: string): void => {
    onLog?.({ level, message });
  };

  // Always read metadata first — needed both for naming AND for the
  // target directory when sorting into year/month is on.
  const dateParts = getOriginalFileDateParts(filePath);

  if (!dateParts) {
    log(LogLevel.SKIP, `Skipping (no embedded original date): ${oldName}`);
    return { renamed: false, moved: false, skipped: true };
  }

  const alreadyFormatted = shouldSkipAlreadyFormatted(
    oldName,
    mode,
    customName,
  );
  const desiredName = alreadyFormatted
    ? oldName
    : buildNewName(oldName, mode, dateParts, customName);

  const currentDir = path.dirname(filePath);
  const targetDir = organizeIntoYearMonth
    ? path.join(root, dateParts.year, dateParts.month)
    : currentDir;

  if (desiredName === oldName && targetDir === currentDir) {
    log(LogLevel.SKIP, `Skipping (already organized): ${oldName}`);
    return { renamed: false, moved: false, skipped: true };
  }

  const finalPath = ensureUniquePath(path.join(targetDir, desiredName));
  const finalName = path.basename(finalPath);
  const willMove = path.dirname(finalPath) !== currentDir;
  const willRename = finalName !== oldName;
  const relTarget = path.relative(root, finalPath);

  if (dryRun) {
    const verb =
      willMove && willRename
        ? "[DRY] Move + rename"
        : willMove
          ? "[DRY] Move"
          : "[DRY] Rename";
    log(LogLevel.DRY, `${verb}: ${oldName} → ${relTarget}`);
    return { renamed: willRename, moved: willMove, skipped: false };
  }

  if (willMove) {
    fs.mkdirSync(path.dirname(finalPath), { recursive: true });
  }
  fs.renameSync(filePath, finalPath);

  const verb =
    willMove && willRename ? "Moved + renamed" : willMove ? "Moved" : "Renamed";
  const level: LogLevel = willMove ? LogLevel.MOVED : LogLevel.RENAMED;
  log(level, `${verb}: ${oldName} → ${relTarget}`);
  return { renamed: willRename, moved: willMove, skipped: false };
}

/**
 * Organize a folder by renaming media files (and optionally moving them
 * into Year/Month subfolders).
 */
export function organizeFolder({
  root,
  mode = Mode.PREFIX,
  dryRun = false,
  customName,
  organizeIntoYearMonth = false,
  scanSubfolders = true,
  onLog,
}: OrganizeOptions): OrganizeSummary {
  if (!root) {
    throw new Error("A target folder is required.");
  }

  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`Invalid folder: ${root}`);
  }

  let safeCustomName = "";
  if (mode === Mode.CUSTOM) {
    safeCustomName = sanitizeCustomName(customName);
    if (!safeCustomName) {
      throw new Error(
        "Custom mode requires a non-empty name (letters, numbers, spaces, dashes, underscores).",
      );
    }
  }

  const log = (level: LogLevel, message: string): void => {
    onLog?.({ level, message });
  };

  log(LogLevel.INFO, `Mode: ${mode}`);
  if (mode === Mode.CUSTOM) {
    log(LogLevel.INFO, `Custom name: ${safeCustomName}`);
  }
  log(LogLevel.INFO, `Root: ${root}`);
  log(
    LogLevel.INFO,
    `Sort into Year/Month folders: ${organizeIntoYearMonth ? "yes" : "no"}`,
  );
  log(LogLevel.INFO, `Scan subfolders: ${scanSubfolders ? "yes" : "no"}`);
  log(LogLevel.INFO, `Dry run: ${dryRun ? "yes" : "no"}`);

  const files = walk(root, scanSubfolders);
  log(LogLevel.INFO, `Found ${files.length} supported file(s).`);

  let renamed = 0;
  let moved = 0;
  let skipped = 0;

  for (const filePath of files) {
    const result = processFile({
      filePath,
      root,
      mode,
      dryRun,
      customName: safeCustomName,
      organizeIntoYearMonth,
      onLog,
    });
    if (result.renamed) renamed += 1;
    if (result.moved) moved += 1;
    if (result.skipped) skipped += 1;
  }

  log(
    LogLevel.DONE,
    `Done. Renamed: ${renamed} · Moved: ${moved} · Skipped: ${skipped}`,
  );

  return { found: files.length, renamed, moved, skipped };
}
