import fs from "node:fs";
import path from "node:path";
import { VALID_EXTENSIONS } from "./naming";

/**
 * Recursively list all supported media files inside `dir`.
 * When `scanSubfolders` is `false`, only files directly inside `dir` are
 * returned (no recursion into any subfolder). `maxFiles` stops the scan once
 * that many supported files have been collected; `-1` means unlimited.
 */
export function walk(
  dir: string,
  scanSubfolders: boolean,
  maxFiles = -1,
  validExtensions: ReadonlySet<string> = VALID_EXTENSIONS,
): string[] {
  const files: string[] = [];

  function visit(currentDir: string): void {
    const entries = fs
      .readdirSync(currentDir, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      if (maxFiles !== -1 && files.length >= maxFiles) return;

      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (!scanSubfolders) continue;
        visit(fullPath);
        continue;
      }

      if (!entry.isFile()) continue;
      if (entry.name.startsWith("._")) continue;

      const ext = path.extname(entry.name).toLowerCase();
      if (validExtensions.has(ext)) {
        files.push(fullPath);
      }
    }
  }

  visit(dir);
  return files;
}
