/// <reference path="../window.d.ts" />
import type { LogEntry, Mode, OrganizeSummary } from "foldnize";

/** Runtime mode strings — cannot import `Mode` from foldnize in the renderer (no bundler). */
const MODE = {
  PREFIX: "prefix" as Mode,
  REPLACE: "replace" as Mode,
  CUSTOM: "custom" as Mode,
};

// Platform hint for CSS (macOS traffic-light padding). Must run in a module
// script — inline scripts are blocked by CSP.
if (window.foldnize?.platform) {
  document.documentElement.dataset.platform = window.foldnize.platform;
}

const websiteLinkBtn = document.getElementById(
  "website-link",
) as HTMLButtonElement;
websiteLinkBtn.addEventListener("click", () => {
  void window.foldnize.openExternal("https://foldnize.com");
});

interface RendererState {
  folderPath: string | null;
}

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
const modeInputs =
  document.querySelectorAll<HTMLInputElement>('input[name="mode"]');
const customRow = document.getElementById("custom-name-row") as HTMLElement;
const customInput = document.getElementById("custom-name") as HTMLInputElement;
const customFeedback = document.getElementById(
  "custom-name-feedback",
) as HTMLParagraphElement;
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

if (!window.foldnize) {
  throw new Error("Foldnize bridge is unavailable — preload did not load.");
}

window.foldnize.onLog((entry: LogEntry) => {
  appendLog(entry);
});

selectBtn.addEventListener("click", async () => {
  try {
    const result = await window.foldnize.selectFolder();
    if (!result) return;

    state.folderPath = result.path;
    folderPathEl.textContent = result.path;
    folderPathEl.classList.remove("muted");
    folderCountEl.textContent = `${result.entryCount} item(s) at top level`;
    refreshRunButton();
  } catch (error) {
    appendLog({
      level: "error" as LogEntry["level"],
      message:
        error instanceof Error
          ? error.message
          : "Could not open folder picker.",
    });
  }
});

function updateCustomNameRow(): void {
  const isCustom = getMode() === MODE.CUSTOM;
  customRow.hidden = !isCustom;
  if (isCustom) {
    customInput.focus();
    refreshCustomNameFeedback();
  }
  refreshRunButton();
}

modeInputs.forEach((input) => {
  input.addEventListener("change", updateCustomNameRow);
});

dryRunEl.addEventListener("change", () => {
  refreshDryRunWarning();
});

customInput.addEventListener("input", () => {
  refreshCustomNameFeedback();
  refreshRunButton();
});

runBtn.addEventListener("click", async () => {
  if (!state.folderPath) return;

  const mode = getMode();
  const dryRun = dryRunEl.checked;
  const customName = mode === MODE.CUSTOM ? customInput.value : undefined;
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
  return MODE.PREFIX;
}

function getSanitizedCustomName(raw: string): string {
  return window.foldnize.sanitizeCustomName(raw);
}

function refreshCustomNameFeedback(): void {
  const raw = customInput.value;
  const sanitized = getSanitizedCustomName(raw);
  const hasText = raw.trim().length > 0;
  const valid = sanitized.length > 0;
  const invalid = hasText && !valid;

  customInput.classList.toggle("invalid", invalid);
  customInput.setAttribute("aria-invalid", String(invalid));

  if (!hasText) {
    customFeedback.hidden = true;
    customFeedback.textContent = "";
    customPreview.classList.remove("is-valid");
    customPreview.innerHTML =
      "Enter a name. Files will become <code>name-YYYYMMDD-HHMMSS.ext</code>";
    return;
  }

  if (invalid) {
    customFeedback.hidden = false;
    customFeedback.textContent =
      "That name can't be used. Avoid path characters (\\ / : * ? \" < > |) and names made only of dots, dashes, or spaces.";
    customPreview.classList.remove("is-valid");
    customPreview.innerHTML =
      '<span class="custom-name-invalid-hint">No valid name to use.</span>';
    return;
  }

  customFeedback.hidden = true;
  customFeedback.textContent = "";

  const wasAdjusted = raw.trim() !== sanitized;
  const adjustedNote = wasAdjusted
    ? ' <span class="custom-name-adjusted">(adjusted from what you typed)</span>'
    : "";

  customPreview.classList.add("is-valid");
  customPreview.innerHTML = `Will use <strong class="used-name">${escapeHtml(sanitized)}</strong>${adjustedNote} → <code>${escapeHtml(sanitized)}-YYYYMMDD-HHMMSS.ext</code>`;
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
    mode !== MODE.CUSTOM ||
    getSanitizedCustomName(customInput.value).length > 0;

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
