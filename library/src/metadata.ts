import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import type { DateParts } from "./naming";

type DateReader = (filePath: string) => DateParts | null;

const MACOS_COMMAND_DIRS = [
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/opt/local/bin",
  "/usr/bin",
];

/** @internal Resolve tools even when a Finder-launched app has a minimal PATH. */
export function resolveCommand(command: string): string | null {
  const pathDirs = (process.env.PATH ?? "")
    .split(path.delimiter)
    .filter(Boolean);
  const directories = [
    ...pathDirs,
    ...(process.platform === "darwin" ? MACOS_COMMAND_DIRS : []),
  ];
  const names = process.platform === "win32"
    ? [`${command}.exe`, command]
    : [command];

  for (const directory of new Set(directories)) {
    for (const name of names) {
      const candidate = path.join(directory, name);
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return candidate;
      } catch {
        // Try the next candidate.
      }
    }
  }

  return null;
}

export function formatDateToParts(
  dateString: string | null | undefined,
): DateParts | null {
  if (!dateString) return null;

  const cleaned = String(dateString).trim();

  // exiftool style: 2023:07:15 14:23:10
  let match = cleaned.match(
    /^(\d{4}):(\d{2}):(\d{2})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/,
  );
  if (match) {
    return {
      year: match[1],
      month: match[2],
      day: match[3],
      hour: match[4] || "00",
      minute: match[5] || "00",
      second: match[6] || "00",
    };
  }

  // ISO style: 2023-07-15T14:23:10.000000Z
  match = cleaned.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}):(\d{2}))?/,
  );
  if (match) {
    return {
      year: match[1],
      month: match[2],
      day: match[3],
      hour: match[4] || "00",
      minute: match[5] || "00",
      second: match[6] || "00",
    };
  }

  return null;
}

function getDateFromExiftool(
  executable: string,
  filePath: string,
): DateParts | null {
  try {
    const output = execFileSync(
      executable,
      [
        "-s3",
        "-DateTimeOriginal",
        "-CreateDate",
        "-MediaCreateDate",
        "-TrackCreateDate",
        "-CreationDate",
        filePath,
      ],
      { encoding: "utf8" },
    )
      .trim()
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean);

    return formatDateToParts(output);
  } catch {
    return null;
  }
}

function getDateFromFfprobe(
  executable: string,
  filePath: string,
): DateParts | null {
  const tagNames = [
    "creation_time",
    "com.apple.quicktime.creationdate",
    "date",
  ];

  for (const tag of tagNames) {
    try {
      const output = execFileSync(
        executable,
        [
          "-v",
          "error",
          "-show_entries",
          `format_tags=${tag}`,
          "-of",
          "default=noprint_wrappers=1:nokey=1",
          filePath,
        ],
        { encoding: "utf8" },
      ).trim();

      const parts = formatDateToParts(output);
      if (parts) return parts;
    } catch {
      // ignore and try next tag
    }
  }

  return null;
}

function realReader(filePath: string): DateParts | null {
  const exiftool = resolveCommand("exiftool");
  if (exiftool) {
    const fromExiftool = getDateFromExiftool(exiftool, filePath);
    if (fromExiftool) return fromExiftool;
  }

  const ext = path.extname(filePath).toLowerCase();
  const ffprobe = resolveCommand("ffprobe");
  if ((ext === ".mp4" || ext === ".mov") && ffprobe) {
    const fromFfprobe = getDateFromFfprobe(ffprobe, filePath);
    if (fromFfprobe) return fromFfprobe;
  }

  return null;
}

let activeReader: DateReader = realReader;

/**
 * Read the embedded original date from a file's metadata.
 *
 * Tries `exiftool` first (works for JPG/PNG/MP4/HEIC and more), then falls
 * back to `ffprobe` for MP4 files. If neither tool is installed, or no
 * recognisable date tag is found, returns `null`.
 */
export function getOriginalFileDateParts(filePath: string): DateParts | null {
  return activeReader(filePath);
}

/**
 * @internal Replace the metadata reader. Used by the test suite to inject
 *           deterministic dates without depending on `exiftool` / `ffprobe`.
 *           Not exposed via the public `foldnize` entrypoint.
 */
export function __setDateReaderForTests(reader: DateReader): void {
  activeReader = reader;
}

/**
 * @internal Restore the real metadata reader after a test override.
 */
export function __resetDateReaderForTests(): void {
  activeReader = realReader;
}
