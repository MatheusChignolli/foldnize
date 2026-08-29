import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ExtensionFilterMode,
  normalizeCustomExtensions,
  parseExtensionList,
  resolveExtensionFilter,
} from "../src/extensions";

test("normalizeCustomExtensions normalizes dots, case, order, and duplicates", () => {
  assert.deepEqual(normalizeCustomExtensions(["RAW", ".gif", "raw"]), [
    ".gif",
    ".raw",
  ]);
  assert.deepEqual(parseExtensionList(" RAW, .gif, raw "), [".gif", ".raw"]);
});

test("normalizeCustomExtensions rejects malformed values", () => {
  for (const value of ["", ".", "photo.jpg", "../jpg", "*.raw"]) {
    assert.throws(() => normalizeCustomExtensions([value]), /Invalid extension/i);
  }
});

test("resolveExtensionFilter supports default, only, and extend modes", () => {
  const defaults = resolveExtensionFilter();
  assert.ok(defaults.has(".jpg"));
  assert.ok(!defaults.has(".raw"));

  const only = resolveExtensionFilter({
    mode: ExtensionFilterMode.ONLY,
    extensions: ["raw"],
  });
  assert.deepEqual([...only], [".raw"]);

  const extended = resolveExtensionFilter({
    mode: ExtensionFilterMode.EXTEND,
    extensions: ["raw"],
  });
  assert.ok(extended.has(".jpg"));
  assert.ok(extended.has(".raw"));
});

test("resolveExtensionFilter requires custom values for only and extend", () => {
  for (const mode of [ExtensionFilterMode.ONLY, ExtensionFilterMode.EXTEND]) {
    assert.throws(
      () => resolveExtensionFilter({ mode, extensions: [] }),
      /requires at least one extension/i,
    );
  }
});
