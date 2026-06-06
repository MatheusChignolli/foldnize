import { test } from "node:test";
import assert from "node:assert/strict";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  sanitizeCustomName,
  buildNewName,
  shouldSkipAlreadyFormatted,
  ensureUniquePath,
  VALID_EXTENSIONS,
  formatSupportedExtensions,
  Mode,
  type DateParts,
} from "../src/naming";

const FULL_STAMP: DateParts = {
  year: "2023",
  month: "07",
  day: "15",
  hour: "14",
  minute: "23",
  second: "10",
};

const DATE_ONLY_STAMP: DateParts = {
  year: "2020",
  month: "01",
  day: "02",
  hour: "00",
  minute: "00",
  second: "00",
};

test("VALID_EXTENSIONS includes every supported media type", () => {
  const expected = [".mov", ".mp3", ".mp4", ".jpg", ".jpeg", ".png"] as const;

  for (const ext of expected) {
    assert.ok(VALID_EXTENSIONS.has(ext), `missing extension ${ext}`);
  }

  assert.equal(VALID_EXTENSIONS.size, expected.length);
});

test("formatSupportedExtensions lists every extension in sorted order", () => {
  assert.equal(
    formatSupportedExtensions(),
    ".jpeg, .jpg, .mov, .mp3, .mp4, .png",
  );
});

test("VALID_EXTENSIONS rejects common non-media extensions", () => {
  const rejected = [".txt", ".pdf", ".heic", ".gif", ".webp", ".zip", ""] as const;

  for (const ext of rejected) {
    assert.ok(!VALID_EXTENSIONS.has(ext), `should not include ${ext}`);
  }
});

test("sanitizeCustomName", () => {
  const cases = [
    {
      name: "strips path separators and illegal filename characters",
      input: 'bad/name:with*chars<>|"\\',
      expected: "badnamewithchars",
    },
    {
      name: "strips control characters",
      input: "trip\u0001\u001fday",
      expected: "tripday",
    },
    {
      name: "collapses internal whitespace",
      input: "  family   trip  ",
      expected: "family trip",
    },
    {
      name: "trims leading and trailing dots",
      input: "...stuff...",
      expected: "stuff",
    },
    {
      name: "trims leading and trailing dashes",
      input: "---weird---",
      expected: "weird",
    },
    {
      name: "trims mixed edge punctuation",
      input: " .- holiday -. ",
      expected: "holiday",
    },
    {
      name: "keeps letters numbers spaces underscores hyphens",
      input: "family-trip_2023",
      expected: "family-trip_2023",
    },
    {
      name: "keeps unicode letters",
      input: "férias 2023",
      expected: "férias 2023",
    },
    {
      name: "empty string",
      input: "",
      expected: "",
    },
    {
      name: "only dots",
      input: "...",
      expected: "",
    },
    {
      name: "only dashes and spaces",
      input: " - - ",
      expected: "",
    },
    {
      name: "null",
      input: null,
      expected: "",
    },
    {
      name: "undefined",
      input: undefined,
      expected: "",
    },
    {
      name: "number",
      input: 42,
      expected: "",
    },
    {
      name: "boolean",
      input: true,
      expected: "",
    },
    {
      name: "object",
      input: { name: "x" },
      expected: "",
    },
  ] as const;

  for (const { name, input, expected } of cases) {
    assert.equal(sanitizeCustomName(input), expected, name);
  }
});

test("buildNewName", () => {
  const cases = [
    {
      name: "prefix — prepends YYYYMMDD-",
      mode: Mode.PREFIX,
      oldName: "IMG_1234.jpg",
      date: FULL_STAMP,
      customName: undefined,
      expected: "20230715-IMG_1234.jpg",
    },
    {
      name: "prefix — preserves dotted original name",
      mode: Mode.PREFIX,
      oldName: "vacation.photo.jpeg",
      date: FULL_STAMP,
      customName: undefined,
      expected: "20230715-vacation.photo.jpeg",
    },
    {
      name: "replace — YYYYMMDD-HHMMSS.ext",
      mode: Mode.REPLACE,
      oldName: "clip.MP4",
      date: FULL_STAMP,
      customName: undefined,
      expected: "20230715-142310.MP4",
    },
    {
      name: "replace — midnight padding",
      mode: Mode.REPLACE,
      oldName: "shot.png",
      date: DATE_ONLY_STAMP,
      customName: undefined,
      expected: "20200102-000000.png",
    },
    {
      name: "custom — name-YYYYMMDD-HHMMSS.ext",
      mode: Mode.CUSTOM,
      oldName: "DSC0001.jpg",
      date: FULL_STAMP,
      customName: "wedding",
      expected: "wedding-20230715-142310.jpg",
    },
    {
      name: "custom — empty customName still builds pattern",
      mode: Mode.CUSTOM,
      oldName: "a.mov",
      date: FULL_STAMP,
      customName: "",
      expected: "-20230715-142310.mov",
    },
  ] as const;

  for (const { name, mode, oldName, date, customName, expected } of cases) {
    assert.equal(buildNewName(oldName, mode, date, customName), expected, name);
  }
});

test("shouldSkipAlreadyFormatted", () => {
  const cases = [
    {
      name: "prefix — already has date prefix",
      mode: Mode.PREFIX,
      fileName: "20230715-IMG_1234.jpg",
      customName: undefined,
      expected: true,
    },
    {
      name: "prefix — plain name needs work",
      mode: Mode.PREFIX,
      fileName: "IMG_1234.jpg",
      customName: undefined,
      expected: false,
    },
    {
      name: "prefix — date-like but wrong shape",
      mode: Mode.PREFIX,
      fileName: "20230715.jpg",
      customName: undefined,
      expected: false,
    },
    {
      name: "replace — exact timestamp",
      mode: Mode.REPLACE,
      fileName: "20230715-142310.jpg",
      customName: undefined,
      expected: true,
    },
    {
      name: "replace — collision suffix still counts",
      mode: Mode.REPLACE,
      fileName: "20230715-142310-2.jpg",
      customName: undefined,
      expected: true,
    },
    {
      name: "replace — missing time component",
      mode: Mode.REPLACE,
      fileName: "20230715-IMG.jpg",
      customName: undefined,
      expected: false,
    },
    {
      name: "custom — matching tag",
      mode: Mode.CUSTOM,
      fileName: "vacation-20230715-142310.jpg",
      customName: "vacation",
      expected: true,
    },
    {
      name: "custom — different tag",
      mode: Mode.CUSTOM,
      fileName: "vacation-20230715-142310.jpg",
      customName: "honeymoon",
      expected: false,
    },
    {
      name: "custom — case-insensitive tag",
      mode: Mode.CUSTOM,
      fileName: "Vacation-20230715-142310.jpg",
      customName: "vacation",
      expected: true,
    },
  ] as const;

  for (const { name, mode, fileName, customName, expected } of cases) {
    assert.equal(
      shouldSkipAlreadyFormatted(fileName, mode, customName),
      expected,
      name,
    );
  }
});

test("ensureUniquePath", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "foldnize-unique-"));

  try {
    const target = path.join(dir, "photo.jpg");
    fs.writeFileSync(target, "a");
    fs.writeFileSync(path.join(dir, "photo-1.jpg"), "b");
    fs.writeFileSync(path.join(dir, "photo-2.jpg"), "c");

    const cases = [
      {
        name: "returns path unchanged when free",
        candidate: path.join(dir, "free.jpg"),
        expectedBasename: "free.jpg",
      },
      {
        name: "appends -1 on first collision",
        candidate: target,
        expectedBasename: "photo-3.jpg",
      },
    ] as const;

    for (const { name, candidate, expectedBasename } of cases) {
      const resolved = ensureUniquePath(candidate);
      assert.equal(path.basename(resolved), expectedBasename, name);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
