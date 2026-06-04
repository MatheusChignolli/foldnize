import type { LogEntry, Mode, OrganizeSummary } from "foldnize";

interface RendererState {
  folderPath: string | null;
}

const INVALID_CHARS_RE = /[\\/:*?"<>|\x00-\x1f]/g;

const selectBtn = document.getElementById("select-folder") as HTMLButtonElement;
const runBtn = document.getElementById("run") as HTMLButtonElement;
const clearBtn = document.getElementById("clear-log") as HTMLButtonElement;
const folderPathEl = document.getElementById("folder-path") as HTMLElement;
const folderCountEl = document.getElementById("folder-count") as HTMLElement;
const dryRunEl = document.getElementById("dry-run") as HTMLInputElement;
const logEl = document.getElementById("log") as HTMLElement;
const summaryEl = document.getElementById("summary") as HTMLElement;
const statFoundEl = document.getElementById("stat-found") as HTMLElement;
const statRenamedEl = document.getElementById("stat-renamed") as HTMLElement;
const statMovedEl = document.getElementById("stat-moved") as HTMLElement;
const statSkippedEl = document.getElementById("stat-skipped") as HTMLElement;
const modeInputs = document.querySelectorAll<HTMLInputElement>(
  'input[name="mode"]',
);
const customRow = document.getElementById("custom-name-row") as HTMLElement;
const customInput = document.getElementById("custom-name") as HTMLInputElement;
const customPreview = document.getElementById(
  "custom-name-preview",
) as HTMLElement;
const dryRunWarning = document.getElementById("dry-run-warning") as HTMLElement;
const organizeYearMonthEl = document.getElementById(
  "organize-year-month",
) as HTMLInputElement;
const scanSubfoldersEl = document.getElementById(
  "scan-subfolders",
) as HTMLInputElement;

const state: RendererState = {
  folderPath: null,
};

window.foldnize.onLog((entry: LogEntry) => {
  appendLog(entry);
});

selectBtn.addEventListener("click", async () => {
  const result = await window.foldnize.selectFolder();
  if (!result) return;

  state.folderPath = result.path;
  folderPathEl.textContent = result.path;
  folderPathEl.classList.remove("muted");
  folderCountEl.textContent = `${result.entryCount} item(s) at top level`;
  refreshRunButton();
});

modeInputs.forEach((input) => {
  input.addEventListener("change", () => {
    const isCustom = getMode() === "custom";
    customRow.hidden = !isCustom;
    if (isCustom) {
      customInput.focus();
    }
    refreshRunButton();
  });
});

dryRunEl.addEventListener("change", () => {
  refreshDryRunWarning();
});

customInput.addEventListener("input", () => {
  const sanitized = sanitizeForPreview(customInput.value);
  customInput.classList.toggle(
    "invalid",
    customInput.value.length > 0 && !sanitized,
  );
  customPreview.innerHTML = sanitized
    ? `Files will become <code>${escapeHtml(sanitized)}-YYYYMMDD-HHMMSS.ext</code>`
    : "Files will become <code>name-YYYYMMDD-HHMMSS.ext</code>";
  refreshRunButton();
});

runBtn.addEventListener("click", async () => {
  if (!state.folderPath) return;

  const mode = getMode();
  const dryRun = dryRunEl.checked;
  const customName = mode === "custom" ? customInput.value : undefined;
  const organizeIntoYearMonth = organizeYearMonthEl.checked;
  const scanSubfolders = scanSubfoldersEl.checked;

  clearLog();
  hideSummary();
  setRunning(true);

  const response = await window.foldnize.organize({
    root: state.folderPath,
    mode,
    dryRun,
    customName,
    organizeIntoYearMonth,
    scanSubfolders,
  });

  setRunning(false);

  if (response.ok) {
    showSummary(response.summary);
  }
});

clearBtn.addEventListener("click", () => {
  clearLog();
  hideSummary();
});

function getMode(): Mode {
  const checked = document.querySelector<HTMLInputElement>(
    'input[name="mode"]:checked',
  );
  const value = checked?.value;
  if (value === "replace" || value === "custom") return value as Mode;
  return "prefix" as Mode;
}

function sanitizeForPreview(raw: string): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(INVALID_CHARS_RE, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.\-\s]+|[.\-\s]+$/g, "");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function refreshRunButton(): void {
  const hasFolder = Boolean(state.folderPath);
  const mode = getMode();
  const customOk =
    mode !== "custom" || sanitizeForPreview(customInput.value).length > 0;

  runBtn.disabled = !(hasFolder && customOk);
}

function refreshDryRunWarning(): void {
  dryRunWarning.hidden = dryRunEl.checked;
}

refreshDryRunWarning();

function appendLog(entry: LogEntry): void {
  const empty = logEl.querySelector(".log-empty");
  if (empty) empty.remove();

  const line = document.createElement("div");
  line.className = `log-line ${entry.level || "info"}`;
  line.textContent = entry.message;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

function clearLog(): void {
  logEl.innerHTML =
    '<div class="log-empty">Logs will appear here once you run.</div>';
}

function setRunning(isRunning: boolean): void {
  runBtn.disabled = isRunning;
  selectBtn.disabled = isRunning;
  customInput.disabled = isRunning;
  dryRunEl.disabled = isRunning;
  organizeYearMonthEl.disabled = isRunning;
  scanSubfoldersEl.disabled = isRunning;
  modeInputs.forEach((input) => {
    input.disabled = isRunning;
  });
  runBtn.textContent = isRunning ? "Organizing…" : "Organize folder";
}

function showSummary(summary: OrganizeSummary): void {
  statFoundEl.textContent = String(summary.found);
  statRenamedEl.textContent = String(summary.renamed);
  statMovedEl.textContent = String(summary.moved ?? 0);
  statSkippedEl.textContent = String(summary.skipped);
  summaryEl.hidden = false;
}

function hideSummary(): void {
  summaryEl.hidden = true;
}
