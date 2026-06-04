import { test } from "node:test";
import assert from "node:assert/strict";

import { formatDateToParts } from "../src/metadata";
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
    { name: "null", input: null },
    { name: "undefined", input: undefined },
  ] as const;

  for (const { name, input } of cases) {
    assert.equal(formatDateToParts(input), null, name);
  }
});
