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

export const DEFAULT_FILE_LIMIT = 50;
export const MAX_FILE_LIMIT = 1000;
export const UNLIMITED_FILE_LIMIT = -1;

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

export enum ProgressPhase {
  SCANNING = "scanning",
  PROCESSING = "processing",
  DONE = "done",
}

export interface OrganizeProgress {
  phase: ProgressPhase;
  processed: number;
  total: number;
  /** Path relative to `root` for the file currently being processed. */
  currentFile?: string;
}

export type ProgressFn = (progress: OrganizeProgress) => void;

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
  /**
   * Maximum number of supported files to count and process. Defaults to `50`.
   * Use `-1` for no limit; finite limits must be integers from `1` to `1000`.
   */
  maxFiles?: number;
  /** Streamed log callback. */
  onLog?: LogFn;
  /** Structured progress callback, emitted while scanning and after each file. */
  onProgress?: ProgressFn;
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
  maxFiles = DEFAULT_FILE_LIMIT,
  onLog,
  onProgress,
}: OrganizeOptions): OrganizeSummary {
  if (!root) {
    throw new Error("A target folder is required.");
  }

  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`Invalid folder: ${root}`);
  }

  if (
    !Number.isInteger(maxFiles) ||
    (maxFiles !== UNLIMITED_FILE_LIMIT &&
      (maxFiles < 1 || maxFiles > MAX_FILE_LIMIT))
  ) {
    throw new Error(
      `maxFiles must be -1 (unlimited) or an integer from 1 to ${MAX_FILE_LIMIT}.`,
    );
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
  log(
    LogLevel.INFO,
    `File limit: ${maxFiles === UNLIMITED_FILE_LIMIT ? "unlimited" : maxFiles}`,
  );
  log(LogLevel.INFO, `Dry run: ${dryRun ? "yes" : "no"}`);

  onProgress?.({
    phase: ProgressPhase.SCANNING,
    processed: 0,
    total: 0,
  });

  const files = walk(root, scanSubfolders, maxFiles);
  log(LogLevel.INFO, `Found ${files.length} supported file(s).`);
  onProgress?.({
    phase: ProgressPhase.PROCESSING,
    processed: 0,
    total: files.length,
  });

  let renamed = 0;
  let moved = 0;
  let skipped = 0;

  for (const [index, filePath] of files.entries()) {
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
    onProgress?.({
      phase: ProgressPhase.PROCESSING,
      processed: index + 1,
      total: files.length,
      currentFile: path.relative(root, filePath),
    });
  }

  log(
    LogLevel.DONE,
    `Done. Renamed: ${renamed} · Moved: ${moved} · Skipped: ${skipped}`,
  );
  onProgress?.({
    phase: ProgressPhase.DONE,
    processed: files.length,
    total: files.length,
  });

  return { found: files.length, renamed, moved, skipped };
}
