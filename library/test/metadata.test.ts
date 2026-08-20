import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  configureMetadataTools,
  formatDateToParts,
  resolveCommand,
} from "../src/metadata";
import type { DateParts } from "../src/naming";

const parts = (
  year: string,
  month: string,
  day: string,
  hour = "00",
  minute = "00",
  second = "00",
): DateParts => ({ year, month, day, hour, minute, second });

test("formatDateToParts — valid date strings", () => {
  const cases = [
    {
      name: "exiftool with time",
      input: "2023:07:15 14:23:10",
      expected: parts("2023", "07", "15", "14", "23", "10"),
    },
    {
      name: "exiftool date only",
      input: "2023:07:15",
      expected: parts("2023", "07", "15"),
    },
    {
      name: "exiftool with leading/trailing whitespace",
      input: "  2023:07:15 14:23:10  ",
      expected: parts("2023", "07", "15", "14", "23", "10"),
    },
    {
      name: "ISO with T separator and fractional seconds",
      input: "2023-07-15T14:23:10.000000Z",
      expected: parts("2023", "07", "15", "14", "23", "10"),
    },
    {
      name: "ISO with space separator",
      input: "2023-07-15 14:23:10",
      expected: parts("2023", "07", "15", "14", "23", "10"),
    },
    {
      name: "ISO date only",
      input: "2023-07-15",
      expected: parts("2023", "07", "15"),
    },
    {
      name: "ISO with timezone offset",
      input: "2023-07-15T08:00:00+02:00",
      expected: parts("2023", "07", "15", "08", "00", "00"),
    },
    {
      name: "midnight exiftool",
      input: "1999:12:31 00:00:00",
      expected: parts("1999", "12", "31", "00", "00", "00"),
    },
    {
      name: "end of year ISO",
      input: "2024-12-31T23:59:59",
      expected: parts("2024", "12", "31", "23", "59", "59"),
    },
  ] as const;

  for (const { name, input, expected } of cases) {
    assert.deepEqual(formatDateToParts(input), expected, name);
  }
});

test("formatDateToParts — rejects invalid input", () => {
  const cases = [
    { name: "empty string", input: "" },
    { name: "whitespace only", input: "   " },
    { name: "random text", input: "not a date" },
    { name: "wrong separators", input: "2023/07/15" },
    { name: "partial date", input: "2023-07" },
    { name: "US slash format", input: "07/15/2023" },
    { name: "unix timestamp digits only", input: "1690000000" },
    { name: "zero EXIF date", input: "0000:00:00 00:00:00" },
    { name: "invalid month", input: "2023:13:15 12:00:00" },
    { name: "invalid calendar day", input: "2023:02:29 12:00:00" },
    { name: "invalid time", input: "2023:07:15 24:00:00" },
    { name: "null", input: null },
    { name: "undefined", input: undefined },
  ] as const;

  for (const { name, input } of cases) {
    assert.equal(formatDateToParts(input), null, name);
  }
});

test("resolveCommand finds an executable on PATH", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "foldnize-path-"));
  const executable = path.join(directory, "metadata-reader");
  const previousPath = process.env.PATH;

  try {
    fs.writeFileSync(executable, "#!/bin/sh\n");
    fs.chmodSync(executable, 0o755);
    process.env.PATH = directory;
    assert.equal(resolveCommand("metadata-reader"), executable);
  } finally {
    process.env.PATH = previousPath;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("resolveCommand prefers a configured executable path with spaces", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "foldnize metadata tools "),
  );
  const executable = path.join(directory, "exiftool.exe");

  try {
    fs.writeFileSync(executable, "executable");
    fs.chmodSync(executable, 0o755);
    configureMetadataTools({ exiftool: executable });
    assert.equal(resolveCommand("exiftool"), executable);
  } finally {
    configureMetadataTools({});
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("resolveCommand falls back to PATH for a missing configured executable", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "foldnize-path-"));
  const executableName = process.platform === "win32" ? "exiftool.exe" : "exiftool";
  const executable = path.join(directory, executableName);
  const previousPath = process.env.PATH;

  try {
    fs.writeFileSync(executable, "executable");
    fs.chmodSync(executable, 0o755);
    process.env.PATH = directory;
    configureMetadataTools({
      exiftool: path.join(directory, "missing-exiftool.exe"),
    });
    assert.equal(resolveCommand("exiftool"), executable);
  } finally {
    configureMetadataTools({});
    process.env.PATH = previousPath;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
