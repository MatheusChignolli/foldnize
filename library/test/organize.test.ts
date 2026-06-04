import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { organizeFolder, LogLevel } from "../src/organize";
import type { LogEntry, OrganizeSummary } from "../src/organize";
import { Mode, type DateParts } from "../src/naming";
import {
  __setDateReaderForTests,
  __resetDateReaderForTests,
} from "../src/metadata";

let root: string;
let collectedLogs: LogEntry[];

const STAMP: DateParts = {
  year: "2023",
  month: "07",
  day: "15",
  hour: "14",
  minute: "23",
  second: "10",
};

const NEW_YEAR_STAMP: DateParts = {
  year: "2024",
  month: "01",
  day: "01",
  hour: "00",
  minute: "00",
  second: "00",
};

function withFakeMetadata<T>(
  map: Record<string, DateParts | null>,
  fn: () => T,
): T {
  __setDateReaderForTests(
    (filePath: string) => map[path.basename(filePath)] ?? null,
  );

  try {
    return fn();
  } finally {
    __resetDateReaderForTests();
  }
}

function writeFile(relativePath: string, content = "x", base = root): void {
  const full = path.join(base, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function clearRoot(): void {
  for (const entry of fs.readdirSync(root)) {
    fs.rmSync(path.join(root, entry), { recursive: true, force: true });
  }
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "foldnize-org-"));
  collectedLogs = [];
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

test("organizeFolder — validation errors", () => {
  const cases = [
    {
      name: "missing root",
      run: () => organizeFolder({ root: "" }),
      message: /target folder is required/i,
    },
    {
      name: "non-existent path",
      run: () => organizeFolder({ root: path.join(root, "nope") }),
      message: /Invalid folder/i,
    },
    {
      name: "file instead of directory",
      run: () => {
        const filePath = path.join(root, "not-a-dir.txt");
        fs.writeFileSync(filePath, "x");
        return organizeFolder({ root: filePath });
      },
      message: /Invalid folder/i,
    },
    {
      name: "custom mode with only dots",
      run: () => organizeFolder({ root, mode: Mode.CUSTOM, customName: "..." }),
      message: /Custom mode requires a non-empty name/i,
    },
    {
      name: "custom mode with only illegal characters",
      run: () =>
        organizeFolder({ root, mode: Mode.CUSTOM, customName: ':/\\*?"' }),
      message: /Custom mode requires a non-empty name/i,
    },
    {
      name: "custom mode with whitespace only",
      run: () => organizeFolder({ root, mode: Mode.CUSTOM, customName: "   " }),
      message: /Custom mode requires a non-empty name/i,
    },
  ] as const;

  for (const { name, run, message } of cases) {
    assert.throws(run, message, name);
  }
});

test("organizeFolder — renaming modes", () => {
  const cases = [
    {
      name: "prefix — YYYYMMDD-original",
      file: "IMG_1234.jpg",
      mode: Mode.PREFIX,
      customName: undefined,
      expectedPath: "20230715-IMG_1234.jpg",
      summary: { found: 1, renamed: 1, moved: 0, skipped: 0 },
    },
    {
      name: "replace — YYYYMMDD-HHMMSS.ext",
      file: "clip.mp4",
      mode: Mode.REPLACE,
      customName: undefined,
      expectedPath: "20230715-142310.mp4",
      summary: { found: 1, renamed: 1, moved: 0, skipped: 0 },
    },
    {
      name: "custom — tag-YYYYMMDD-HHMMSS.ext",
      file: "DSC.jpg",
      mode: Mode.CUSTOM,
      customName: "vacation",
      expectedPath: "vacation-20230715-142310.jpg",
      summary: { found: 1, renamed: 1, moved: 0, skipped: 0 },
    },
  ] as const;

  for (const { name, file, mode, customName, expectedPath, summary } of cases) {
    clearRoot();
    writeFile(file);

    const result = withFakeMetadata({ [file]: STAMP }, () =>
      organizeFolder({ root, mode, customName }),
    );

    assert.deepEqual(result, summary, `${name} — summary`);
    assert.ok(fs.existsSync(path.join(root, expectedPath)), `${name} — output`);
    assert.ok(
      !fs.existsSync(path.join(root, file)),
      `${name} — source removed`,
    );
  }
});

test("organizeFolder — dry-run never writes to disk", () => {
  const cases = [
    {
      name: "prefix dry-run",
      file: "dry.jpg",
      mode: Mode.PREFIX,
      expectedWouldBe: "20230715-dry.jpg",
    },
    {
      name: "replace dry-run",
      file: "dry.mp4",
      mode: Mode.REPLACE,
      expectedWouldBe: "20230715-142310.mp4",
    },
  ] as const;

  for (const { name, file, mode, expectedWouldBe } of cases) {
    clearRoot();
    writeFile(file);

    const summary = withFakeMetadata({ [file]: STAMP }, () =>
      organizeFolder({ root, mode, dryRun: true }),
    );

    assert.equal(summary.renamed, 1, `${name} — counts as would-rename`);
    assert.ok(fs.existsSync(path.join(root, file)), `${name} — original kept`);
    assert.ok(
      !fs.existsSync(path.join(root, expectedWouldBe)),
      `${name} — target not created`,
    );
  }
});

test("organizeFolder — year/month sorting", () => {
  writeFile("party.jpg");

  const summary = withFakeMetadata({ "party.jpg": STAMP }, () =>
    organizeFolder({
      root,
      mode: Mode.PREFIX,
      organizeIntoYearMonth: true,
    }),
  );

  assert.deepEqual(summary, {
    found: 1,
    renamed: 1,
    moved: 1,
    skipped: 0,
  });
  assert.ok(fs.existsSync(path.join(root, "2023", "07", "20230715-party.jpg")));
  assert.ok(!fs.existsSync(path.join(root, "party.jpg")));
});

test("organizeFolder — move without rename when already prefixed", () => {
  writeFile("20230715-already.jpg");

  const summary = withFakeMetadata({ "20230715-already.jpg": STAMP }, () =>
    organizeFolder({
      root,
      mode: Mode.PREFIX,
      organizeIntoYearMonth: true,
    }),
  );

  assert.equal(summary.renamed, 0);
  assert.equal(summary.moved, 1);
  assert.ok(
    fs.existsSync(path.join(root, "2023", "07", "20230715-already.jpg")),
  );
});

test("organizeFolder — scanSubfolders", () => {
  const cases = [
    {
      name: "recursive — processes nested files",
      scanSubfolders: true,
      expectedFound: 2,
      nestedUntouched: false,
    },
    {
      name: "top-level only — skips subfolders",
      scanSubfolders: false,
      expectedFound: 1,
      nestedUntouched: true,
    },
  ] as const;

  for (const {
    name,
    scanSubfolders,
    expectedFound,
    nestedUntouched,
  } of cases) {
    clearRoot();
    writeFile("top.jpg");
    writeFile("sub/nested.jpg");

    const summary = withFakeMetadata(
      { "top.jpg": STAMP, "nested.jpg": STAMP },
      () => organizeFolder({ root, mode: Mode.PREFIX, scanSubfolders }),
    );

    assert.equal(summary.found, expectedFound, `${name} — found`);
    assert.ok(
      fs.existsSync(path.join(root, "20230715-top.jpg")),
      `${name} — top`,
    );

    const nestedStill = fs.existsSync(path.join(root, "sub", "nested.jpg"));
    const nestedRenamed = fs.existsSync(
      path.join(root, "sub", "20230715-nested.jpg"),
    );

    if (nestedUntouched) {
      assert.ok(nestedStill, `${name} — nested unchanged`);
      assert.ok(!nestedRenamed, `${name} — nested not renamed`);
    } else {
      assert.ok(!nestedStill, `${name} — nested renamed in place`);
      assert.ok(nestedRenamed, `${name} — nested output exists`);
    }
  }
});

test("organizeFolder — skip behaviour", () => {
  const cases = [
    {
      name: "no metadata — skipped safely",
      file: "no-meta.jpg",
      metadata: {} as Record<string, DateParts | null>,
      summary: { found: 1, renamed: 0, moved: 0, skipped: 1 },
      outputExists: "no-meta.jpg",
    },
    {
      name: "already prefixed — idempotent",
      file: "20230715-done.jpg",
      metadata: { "20230715-done.jpg": STAMP },
      summary: { found: 1, renamed: 0, moved: 0, skipped: 1 },
      outputExists: "20230715-done.jpg",
    },
    {
      name: "replace already formatted — idempotent",
      file: "20230715-142310.jpg",
      metadata: { "20230715-142310.jpg": STAMP },
      summary: { found: 1, renamed: 0, moved: 0, skipped: 1 },
      outputExists: "20230715-142310.jpg",
    },
  ] as const;

  for (const { name, file, metadata, summary, outputExists } of cases) {
    clearRoot();
    writeFile(file);

    const result = withFakeMetadata(metadata, () =>
      organizeFolder({ root, mode: Mode.PREFIX }),
    );

    assert.deepEqual(result, summary, `${name} — summary`);
    assert.ok(fs.existsSync(path.join(root, outputExists)), `${name} — file`);
  }
});

test("organizeFolder — collision suffixes", () => {
  writeFile("a.jpg");
  writeFile("b.jpg");
  writeFile("c.jpg");

  withFakeMetadata(
    {
      "a.jpg": STAMP,
      "b.jpg": STAMP,
      "c.jpg": STAMP,
    },
    () => organizeFolder({ root, mode: Mode.REPLACE }),
  );

  const expected = [
    "20230715-142310.jpg",
    "20230715-142310-1.jpg",
    "20230715-142310-2.jpg",
  ] as const;

  for (const name of expected) {
    assert.ok(fs.existsSync(path.join(root, name)), `missing ${name}`);
  }
});

test("organizeFolder — multiple files mixed outcomes", () => {
  writeFile("rename-me.jpg");
  writeFile("skip-me.jpg");
  writeFile("nested/also.jpg");

  const summary = withFakeMetadata(
    {
      "rename-me.jpg": STAMP,
      "skip-me.jpg": null,
      "also.jpg": NEW_YEAR_STAMP,
    },
    () =>
      organizeFolder({
        root,
        mode: Mode.REPLACE,
        organizeIntoYearMonth: true,
      }),
  );

  assert.deepEqual(summary, {
    found: 3,
    renamed: 2,
    moved: 2,
    skipped: 1,
  });
  assert.ok(
    fs.existsSync(path.join(root, "2023", "07", "20230715-142310.jpg")),
  );
  assert.ok(
    fs.existsSync(path.join(root, "2024", "01", "20240101-000000.jpg")),
  );
  assert.ok(fs.existsSync(path.join(root, "skip-me.jpg")));
});

test("organizeFolder — onLog emits expected levels", () => {
  writeFile("logged.jpg");

  withFakeMetadata({ "logged.jpg": STAMP }, () =>
    organizeFolder({
      root,
      mode: Mode.PREFIX,
      onLog: (entry) => collectedLogs.push(entry),
    }),
  );

  const levels = collectedLogs.map((e) => e.level);
  const required = [LogLevel.INFO, LogLevel.RENAMED, LogLevel.DONE] as const;

  for (const level of required) {
    assert.ok(levels.includes(level), `missing log level ${level}`);
  }
});

test("organizeFolder — dry-run logs use DRY level", () => {
  writeFile("preview.jpg");

  withFakeMetadata({ "preview.jpg": STAMP }, () =>
    organizeFolder({
      root,
      mode: Mode.PREFIX,
      dryRun: true,
      onLog: (entry) => collectedLogs.push(entry),
    }),
  );

  assert.ok(collectedLogs.some((e) => e.level === LogLevel.DRY));
  assert.ok(
    collectedLogs.some(
      (e) => e.level === LogLevel.DRY && e.message.includes("[DRY]"),
    ),
  );
});

test("organizeFolder — empty folder", () => {
  const summary = withFakeMetadata({}, () =>
    organizeFolder({ root, mode: Mode.PREFIX }),
  );

  assert.deepEqual(summary, {
    found: 0,
    renamed: 0,
    moved: 0,
    skipped: 0,
  } satisfies OrganizeSummary);
});
