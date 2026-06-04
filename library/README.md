# foldnize

Organize photos and videos by their embedded EXIF/QuickTime **original date**, programmatically or from the command line.

- Three renaming modes: **prefix** · **replace** · **custom**
- Optional **Year/Month folder sorting** (`<root>/YYYY/MM/`)
- **Dry-run** preview before touching disk
- Streamed log of every action via callback
- 100% local — no network, no telemetry
- Written in **TypeScript**, ships compiled JS + `.d.ts` types, **zero runtime dependencies**
- Powers the [Foldnize desktop app](https://github.com/matheuschignolli/foldnize)

## Install

```bash
npm install foldnize
```

### System tools (optional but recommended)

`foldnize` shells out to read embedded metadata. Install one or both:

```bash
brew install exiftool       # photos + most formats — best coverage
brew install ffmpeg         # ffprobe — fallback for .mp4
```

Files without parseable date metadata are silently skipped — never crash.

## Library usage

```ts
import {
  organizeFolder,
  type OrganizeOptions,
  type OrganizeSummary,
  type Mode,
} from "foldnize";
// CommonJS works too: const { organizeFolder } = require("foldnize");

const summary: OrganizeSummary = organizeFolder({
  root: "/Users/you/Pictures/2023",
  mode: Mode.CUSTOM, // Mode.PREFIX | Mode.REPLACE | Mode.CUSTOM
  customName: "vacation", // required when mode === Mode.CUSTOM
  organizeIntoYearMonth: true, // move files into <root>/YYYY/MM/
  scanSubfolders: true, // recurse (default); false = top-level only
  dryRun: true, // preview only — no disk writes
  onLog: ({ level, message }) => console.log(`[${level}] ${message}`),
});

console.log(summary);
// {
//   found: 12,
//   renamed: 8,
//   moved: 4,
//   skipped: 4,
// }
```

A file can appear in **both** `renamed` and `moved` counts if it changes name AND directory.

### Modes

| Mode      | Result                                        | Example                                         |
| --------- | --------------------------------------------- | ----------------------------------------------- |
| `prefix`  | Keep original name, add `YYYYMMDD-` in front. | `IMG_1234.jpg` → `20230715-IMG_1234.jpg`        |
| `replace` | Fully rename to `YYYYMMDD-HHMMSS.ext`.        | `IMG_1234.jpg` → `20230715-142310.jpg`          |
| `custom`  | Fully rename to `{name}-YYYYMMDD-HHMMSS.ext`. | `IMG_1234.jpg` → `vacation-20230715-142310.jpg` |

### Log levels

`onLog` receives `{ level, message }` for every step:

| Level     | Meaning                                                 |
| --------- | ------------------------------------------------------- |
| `info`    | Configuration banner before scanning starts.            |
| `renamed` | File was renamed in place (same directory).             |
| `moved`   | File was moved (possibly renamed too).                  |
| `dry`     | Dry-run preview line.                                   |
| `skip`    | File was untouched (no metadata, already formatted, …). |
| `error`   | Something went wrong with a specific file.              |
| `done`    | Final summary line.                                     |

### Other exports

```ts
import {
  organizeFolder,
  sanitizeCustomName, // (unknown) => string — same rules as in CLI
  getOriginalFileDateParts, // (filePath: string) => DateParts | null
  formatDateToParts, // (dateString: string | null) => DateParts | null
  VALID_EXTENSIONS, // ReadonlySet<".mp4" | ".jpg" | ".jpeg" | ".png">
  type DateParts,
  type Mode,
  type LogEntry,
  type LogLevel,
  type OrganizeOptions,
  type OrganizeSummary,
} from "foldnize";
```

## CLI usage

The package ships a CLI you can run without installing globally:

```bash
npx foldnize --root=./photos --mode=prefix --dry-run
npx foldnize --root=./photos --mode=replace --year-month
npx foldnize --root=./photos --mode=custom --custom-name=vacation
npx foldnize --root=./photos --year-month --no-subfolders
```

### Options

```
--root=PATH               Folder to scan (default: current directory)
--mode=prefix|replace|custom
--custom-name=NAME        Required when --mode=custom
--year-month              Move files into <root>/YYYY/MM/
--no-subfolders           Don't recurse — only top-level files
--dry-run                 Preview without touching disk
--help, -h
--version, -v
```

### Behaviour notes

- **macOS junk files** (`._*`) are always skipped.
- **Collisions** are handled by appending `-1`, `-2`, … to the target name.
- **Already-formatted files** are detected and skipped for renames; they still get moved if `--year-month` is on and their date metadata points to a different folder than where they currently sit.
- **Empty source folders** left behind after moves are NOT deleted. That's intentionally non-destructive.

## Requirements

- Node.js **18+**

## Development

```bash
git clone https://github.com/matheuschignolli/foldnize.git
cd foldnize/library
npm install

npm run build       # compile TypeScript → dist/
npm run build:watch # incremental rebuilds
npm run typecheck   # type-check tests too (no emit)
npm test            # run the test suite (via tsx, no separate compile step)
npm run clean       # remove dist/
```

Source lives in `src/` (TypeScript). Compiled output lands in `dist/` and is the only thing that ships to npm.

## License

MIT
