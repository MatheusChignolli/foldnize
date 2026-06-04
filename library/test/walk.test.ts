import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { walk } from "../src/walk";

let root: string;

function write(relativePath: string, content = "x"): void {
  const full = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "foldnize-walk-"));

  write("top.jpg");
  write("TOP.JPEG");
  write("clip.MOV");
  write("audio.mp3");
  write("notes.txt");
  write("._junk.jpg");
  write("._hidden.mp4");
  write("sub/photo.jpg");
  write("sub/nested/deep.png");
  write("2023/06/archive.jpg");
  write("empty-dir/.keep");
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function basenames(files: string[]): string[] {
  return files.map((f) => path.basename(f)).sort();
}

test("walk — recursive scan finds all supported media", () => {
  const cases = [
    {
      name: "scanSubfolders: true — full tree",
      scanSubfolders: true,
      expected: [
        "TOP.JPEG",
        "archive.jpg",
        "audio.mp3",
        "clip.MOV",
        "deep.png",
        "photo.jpg",
        "top.jpg",
      ],
    },
    {
      name: "scanSubfolders: false — top level only",
      scanSubfolders: false,
      expected: ["TOP.JPEG", "audio.mp3", "clip.MOV", "top.jpg"],
    },
  ] as const;

  for (const { name, scanSubfolders, expected } of cases) {
    assert.deepEqual(basenames(walk(root, scanSubfolders)), expected, name);
  }
});

test("walk — never returns junk or unsupported files", () => {
  const files = walk(root, true);
  const names = basenames(files);

  const mustExclude = [
    "notes.txt",
    "._junk.jpg",
    "._hidden.mp4",
    ".keep",
  ] as const;

  for (const name of mustExclude) {
    assert.ok(!names.includes(name), `should exclude ${name}`);
  }

  const mustInclude = ["top.jpg", "TOP.JPEG", "clip.MOV", "audio.mp3"] as const;

  for (const name of mustInclude) {
    assert.ok(names.includes(name), `should include ${name}`);
  }
});

test("walk — extension matching is case-insensitive", () => {
  const files = walk(root, true);
  assert.ok(files.some((f) => path.basename(f) === "TOP.JPEG"));
  assert.ok(files.some((f) => path.basename(f) === "clip.MOV"));
});

test("walk — empty directory returns no files", () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "foldnize-walk-empty-"));
  try {
    assert.deepEqual(walk(empty, true), []);
    assert.deepEqual(walk(empty, false), []);
  } finally {
    fs.rmSync(empty, { recursive: true, force: true });
  }
});

test("walk — only unsupported files at top level", () => {
  const onlyTxt = fs.mkdtempSync(path.join(os.tmpdir(), "foldnize-walk-txt-"));
  try {
    fs.writeFileSync(path.join(onlyTxt, "readme.txt"), "x");
    fs.writeFileSync(path.join(onlyTxt, "data.csv"), "x");
    assert.deepEqual(walk(onlyTxt, true), []);
  } finally {
    fs.rmSync(onlyTxt, { recursive: true, force: true });
  }
});
