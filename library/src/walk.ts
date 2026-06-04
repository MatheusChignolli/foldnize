import fs from "node:fs";
import path from "node:path";
import { VALID_EXTENSIONS } from "./naming";

/**
 * Recursively list all supported media files inside `dir`.
 * When `scanSubfolders` is `false`, only files directly inside `dir` are
 * returned (no recursion into any subfolder).
 */
export function walk(dir: string, scanSubfolders: boolean): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!scanSubfolders) continue;
      files = files.concat(walk(fullPath, scanSubfolders));
      continue;
    }

    if (!entry.isFile()) continue;
    if (entry.name.startsWith("._")) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (VALID_EXTENSIONS.has(ext)) {
      files.push(fullPath);
    }
  }

  return files;
}
