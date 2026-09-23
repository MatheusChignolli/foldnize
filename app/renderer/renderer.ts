/// <reference path="../window.d.ts" />
import type {
  ExtensionFilterMode,
  ExtensionFilterOptions,
  LogEntry,
  Mode,
  OrganizeProgress,
  OrganizeSummary,
} from "foldnize";

/** Runtime mode strings — cannot import `Mode` from foldnize in the renderer (no bundler). */
const MODE = {
  PREFIX: "prefix" as Mode,
  REPLACE: "replace" as Mode,
  CUSTOM: "custom" as Mode,
};

const EXTENSION_FILTER_MODE = {
  DEFAULT: "default" as ExtensionFilterMode,
  ONLY: "only" as ExtensionFilterMode,
  EXTEND: "extend" as ExtensionFilterMode,
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

const versionPill = document.getElementById(
  "version-pill",
) as HTMLButtonElement;
const versionLabel = document.getElementById("version-label") as HTMLElement;
let updateReleaseUrl: string | null = null;
let isRunning = false;

versionPill.addEventListener("click", () => {
  if (updateReleaseUrl) {
    void window.foldnize.openExternal(updateReleaseUrl);
  }
});

async function refreshVersionPill(): Promise<void> {
  const update = await window.foldnize.checkForUpdate();
  versionLabel.textContent = `v${update.currentVersion}`;

  if (!update.updateAvailable || !update.latestVersion || !update.releaseUrl) {
    return;
  }

  updateReleaseUrl = update.releaseUrl;
  versionLabel.textContent = `v${update.currentVersion} · Update v${update.latestVersion}`;
  versionPill.disabled = isRunning;
  versionPill.classList.add("has-update");
  versionPill.setAttribute(
    "aria-label",
    `Foldnize ${update.latestVersion} is available. Open the download page.`,
  );
  versionPill.title = "Download the latest Foldnize release";
}

void refreshVersionPill();

interface RendererState {
  folderPath: string | null;
}

interface PersistedSettings {
  version: 1;
  folderPath: string | null;
  mode: Mode;
  customName: string;
  organizeIntoYearMonth: boolean;
  scanSubfolders: boolean;
  dryRun: boolean;
  maxFiles: number;
  unlimitedFiles: boolean;
  extensionMode: ExtensionFilterMode;
  customExtensions: string;
}

const SETTINGS_STORAGE_KEY = "foldnize:desktop-settings:v1";

const selectBtn = document.getElementById("select-folder") as HTMLButtonElement;
const runBtn = document.getElementById("run") as HTMLButtonElement;
const cancelBtn = document.getElementById("cancel-run") as HTMLButtonElement;
const clearBtn = document.getElementById("clear-log") as HTMLButtonElement;
const appMainEl = document.querySelector(".app-main") as HTMLElement;
const progressEl = document.getElementById("run-progress") as HTMLElement;
const progressBarEl = document.getElementById(
  "progress-bar",
) as HTMLProgressElement;
const progressLabelEl = document.getElementById(
  "progress-label",
) as HTMLElement;
const progressCountEl = document.getElementById(
  "progress-count",
) as HTMLElement;
const progressFileEl = document.getElementById(
  "progress-file",
) as HTMLElement;
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
const fileLimitEl = document.getElementById("file-limit") as HTMLInputElement;
const unlimitedFilesEl = document.getElementById(
  "unlimited-files",
) as HTMLInputElement;
const fileLimitFeedback = document.getElementById(
  "file-limit-feedback",
) as HTMLParagraphElement;
const extensionModeEl = document.getElementById(
  "extension-mode",
) as HTMLSelectElement;
const customExtensionRow = document.getElementById(
  "custom-extension-row",
) as HTMLElement;
const customExtensionsEl = document.getElementById(
  "custom-extensions",
) as HTMLInputElement;
const extensionFeedbackEl = document.getElementById(
  "extension-feedback",
) as HTMLParagraphElement;
const confirmDialog = document.getElementById(
  "confirm-real-run",
) as HTMLDialogElement;
const confirmFolderEl = document.getElementById(
  "confirm-folder",
) as HTMLElement;
const confirmModeEl = document.getElementById("confirm-mode") as HTMLElement;
const confirmLimitEl = document.getElementById("confirm-limit") as HTMLElement;
const confirmExtensionsEl = document.getElementById(
  "confirm-extensions",
) as HTMLElement;
const confirmYearMonthEl = document.getElementById(
  "confirm-year-month",
) as HTMLElement;

const state: RendererState = {
  folderPath: null,
};

if (!window.foldnize) {
  throw new Error("Foldnize bridge is unavailable — preload did not load.");
}

window.foldnize.onLog((entry: LogEntry) => {
  appendLog(entry);
});

window.foldnize.onProgress((progress: OrganizeProgress) => {
  updateProgress(progress);
});

selectBtn.addEventListener("click", async () => {
  try {
    const result = await window.foldnize.selectFolder();
    if (!result) return;

    state.folderPath = result.path;
    folderPathEl.textContent = result.path;
    folderPathEl.classList.remove("muted");
    folderCountEl.textContent = `${result.entryCount} item(s) at top level`;
    persistSettings();
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

function updateCustomNameRow(focusInput = true): void {
  const isCustom = getMode() === MODE.CUSTOM;
  customRow.hidden = !isCustom;
  if (isCustom) {
    if (focusInput) customInput.focus();
    refreshCustomNameFeedback();
  }
  refreshRunButton();
}

modeInputs.forEach((input) => {
  input.addEventListener("change", () => {
    updateCustomNameRow();
    persistSettings();
  });
});

dryRunEl.addEventListener("change", () => {
  refreshDryRunWarning();
  persistSettings();
});

customInput.addEventListener("input", () => {
  refreshCustomNameFeedback();
  refreshRunButton();
  persistSettings();
});

organizeYearMonthEl.addEventListener("change", persistSettings);
scanSubfoldersEl.addEventListener("change", persistSettings);

extensionModeEl.addEventListener("change", () => {
  refreshExtensionFilter();
  refreshRunButton();
  persistSettings();
});

customExtensionsEl.addEventListener("input", () => {
  refreshExtensionFilter();
  refreshRunButton();
  persistSettings();
});

fileLimitEl.addEventListener("input", () => {
  refreshFileLimitFeedback();
  refreshRunButton();
  persistSettings();
});

unlimitedFilesEl.addEventListener("change", () => {
  fileLimitEl.disabled = unlimitedFilesEl.checked;
  refreshFileLimitFeedback();
  refreshRunButton();
  persistSettings();
});

runBtn.addEventListener("click", async () => {
  if (!state.folderPath) return;

  const mode = getMode();
  const dryRun = dryRunEl.checked;
  const customName = mode === MODE.CUSTOM ? customInput.value : undefined;
  const organizeIntoYearMonth = organizeYearMonthEl.checked;
  const scanSubfolders = scanSubfoldersEl.checked;
  const maxFiles = unlimitedFilesEl.checked ? -1 : fileLimitEl.valueAsNumber;
  const extensionFilter = getExtensionFilter();

  if (
    !dryRun &&
    !(await confirmRealRun({
      folderPath: state.folderPath,
      mode,
      maxFiles,
      extensionDescription: describeExtensionFilter(extensionFilter),
      organizeIntoYearMonth,
    }))
  ) {
    return;
  }

  clearLog();
  hideSummary();
  resetProgress();
  setRunning(true);

  try {
    const response = await window.foldnize.organize({
      root: state.folderPath,
      mode,
      dryRun,
      customName,
      organizeIntoYearMonth,
      scanSubfolders,
      maxFiles,
      extensionFilter,
    });

    if (response.ok) {
      showSummary(response.summary);
      if (response.summary.cancelled) {
        clearProgress();
      }
    }
  } catch (error) {
    appendLog({
      level: "error" as LogEntry["level"],
      message:
        error instanceof Error
          ? error.message
          : "The organization worker could not be started.",
    });
  } finally {
    setRunning(false);
  }
});

clearBtn.addEventListener("click", () => {
  clearLog();
  hideSummary();
});

cancelBtn.addEventListener("click", async () => {
  cancelBtn.disabled = true;
  cancelBtn.textContent = "Canceling safely…";
  progressLabelEl.textContent = "Finishing the current file…";

  try {
    const accepted = await window.foldnize.cancelOrganization();
    if (!accepted && isRunning) {
      cancelBtn.disabled = false;
      cancelBtn.textContent = "Cancel safely";
    }
  } catch (error) {
    appendLog({
      level: "error" as LogEntry["level"],
      message:
        error instanceof Error
          ? error.message
          : "The cancellation request could not be sent.",
    });
    if (isRunning) {
      cancelBtn.disabled = false;
      cancelBtn.textContent = "Cancel safely";
    }
  }
});

function getMode(): Mode {
  const checked = document.querySelector<HTMLInputElement>(
    'input[name="mode"]:checked',
  );
  const value = checked?.value;
  if (value === "replace" || value === "custom") return value as Mode;
  return MODE.PREFIX;
}

function getExtensionMode(): ExtensionFilterMode {
  const value = extensionModeEl.value;
  if (value === EXTENSION_FILTER_MODE.ONLY) {
    return EXTENSION_FILTER_MODE.ONLY;
  }
  if (value === EXTENSION_FILTER_MODE.EXTEND) {
    return EXTENSION_FILTER_MODE.EXTEND;
  }
  return EXTENSION_FILTER_MODE.DEFAULT;
}

function getExtensionFilter(): ExtensionFilterOptions {
  const mode = getExtensionMode();
  return mode === EXTENSION_FILTER_MODE.DEFAULT
    ? { mode }
    : {
        mode,
        extensions: window.foldnize.parseExtensionList(
          customExtensionsEl.value,
        ),
      };
}

function getExtensionFilterError(): string | null {
  if (getExtensionMode() === EXTENSION_FILTER_MODE.DEFAULT) return null;

  try {
    const extensions = window.foldnize.parseExtensionList(
      customExtensionsEl.value,
    );
    return extensions.length > 0
      ? null
      : "Enter at least one custom extension, separated by commas.";
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Enter valid extensions such as raw, .gif, or webp.";
  }
}

function refreshExtensionFilter(): void {
  const usesCustom = getExtensionMode() !== EXTENSION_FILTER_MODE.DEFAULT;
  customExtensionRow.hidden = !usesCustom;
  const error = getExtensionFilterError();
  const invalid = error !== null;
  customExtensionsEl.classList.toggle("invalid", invalid);
  customExtensionsEl.setAttribute("aria-invalid", String(invalid));
  extensionFeedbackEl.hidden = !invalid;
  extensionFeedbackEl.textContent = error ?? "";
}

function describeExtensionFilter(filter: ExtensionFilterOptions): string {
  if (filter.mode === EXTENSION_FILTER_MODE.DEFAULT) {
    return "Default formats";
  }

  const extensions = filter.extensions?.join(", ") ?? "";
  return filter.mode === EXTENSION_FILTER_MODE.ONLY
    ? `Only ${extensions}`
    : `Defaults + ${extensions}`;
}

interface RealRunConfirmation {
  folderPath: string;
  mode: Mode;
  maxFiles: number;
  extensionDescription: string;
  organizeIntoYearMonth: boolean;
}

function confirmRealRun(details: RealRunConfirmation): Promise<boolean> {
  confirmFolderEl.textContent = details.folderPath;
  confirmModeEl.textContent =
    details.mode === MODE.CUSTOM
      ? `Custom (${getSanitizedCustomName(customInput.value)})`
      : details.mode === MODE.REPLACE
        ? "Replace"
        : "Prefix";
  confirmLimitEl.textContent =
    details.maxFiles === -1 ? "Unlimited" : String(details.maxFiles);
  confirmExtensionsEl.textContent = details.extensionDescription;
  confirmYearMonthEl.textContent = details.organizeIntoYearMonth ? "Yes" : "No";
  confirmDialog.returnValue = "cancel";
  confirmDialog.showModal();

  return new Promise((resolve) => {
    confirmDialog.addEventListener(
      "close",
      () => resolve(confirmDialog.returnValue === "confirm"),
      { once: true },
    );
  });
}

function persistSettings(): void {
  const maxFiles = fileLimitEl.valueAsNumber;
  const settings: PersistedSettings = {
    version: 1,
    folderPath: state.folderPath,
    mode: getMode(),
    customName: customInput.value,
    organizeIntoYearMonth: organizeYearMonthEl.checked,
    scanSubfolders: scanSubfoldersEl.checked,
    dryRun: dryRunEl.checked,
    maxFiles:
      Number.isInteger(maxFiles) && maxFiles >= 1 && maxFiles <= 1000
        ? maxFiles
        : 50,
    unlimitedFiles: unlimitedFilesEl.checked,
    extensionMode: getExtensionMode(),
    customExtensions: customExtensionsEl.value,
  };

  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Persistence is a convenience; storage failures must never block a run.
  }
}

function restoreSettings(): void {
  let saved: Partial<PersistedSettings> | null = null;
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;
    saved = parsed as Partial<PersistedSettings>;
  } catch {
    return;
  }

  if (saved.version !== 1) return;

  if (typeof saved.folderPath === "string" && saved.folderPath.trim()) {
    state.folderPath = saved.folderPath;
    folderPathEl.textContent = saved.folderPath;
    folderPathEl.classList.remove("muted");
    folderCountEl.textContent = "Restored from the previous session";
  }

  if (
    saved.mode === MODE.PREFIX ||
    saved.mode === MODE.REPLACE ||
    saved.mode === MODE.CUSTOM
  ) {
    const input = document.querySelector<HTMLInputElement>(
      `input[name="mode"][value="${saved.mode}"]`,
    );
    if (input) input.checked = true;
  }

  if (typeof saved.customName === "string") {
    customInput.value = saved.customName.slice(0, 60);
  }
  if (typeof saved.organizeIntoYearMonth === "boolean") {
    organizeYearMonthEl.checked = saved.organizeIntoYearMonth;
  }
  if (typeof saved.scanSubfolders === "boolean") {
    scanSubfoldersEl.checked = saved.scanSubfolders;
  }
  if (typeof saved.dryRun === "boolean") {
    dryRunEl.checked = saved.dryRun;
  }
  if (
    Number.isInteger(saved.maxFiles) &&
    Number(saved.maxFiles) >= 1 &&
    Number(saved.maxFiles) <= 1000
  ) {
    fileLimitEl.value = String(saved.maxFiles);
  }
  if (typeof saved.unlimitedFiles === "boolean") {
    unlimitedFilesEl.checked = saved.unlimitedFiles;
  }
  if (
    saved.extensionMode === EXTENSION_FILTER_MODE.DEFAULT ||
    saved.extensionMode === EXTENSION_FILTER_MODE.ONLY ||
    saved.extensionMode === EXTENSION_FILTER_MODE.EXTEND
  ) {
    extensionModeEl.value = saved.extensionMode;
  }
  if (typeof saved.customExtensions === "string") {
    customExtensionsEl.value = saved.customExtensions.slice(0, 500);
  }
  fileLimitEl.disabled = unlimitedFilesEl.checked;
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
  const fileLimitOk = getFileLimitError() === null;
  const extensionFilterOk = getExtensionFilterError() === null;

  runBtn.disabled = !(hasFolder && customOk && fileLimitOk && extensionFilterOk);
}

function getFileLimitError(): string | null {
  if (unlimitedFilesEl.checked) return null;

  const value = fileLimitEl.valueAsNumber;
  if (!Number.isInteger(value) || value < 1 || value > 1000) {
    return "Enter a whole number from 1 to 1000, or select No limit.";
  }

  return null;
}

function refreshFileLimitFeedback(): void {
  const error = getFileLimitError();
  const invalid = error !== null;
  fileLimitEl.classList.toggle("invalid", invalid);
  fileLimitEl.setAttribute("aria-invalid", String(invalid));
  fileLimitFeedback.hidden = !invalid;
  fileLimitFeedback.textContent = error ?? "";
}

function refreshDryRunWarning(): void {
  dryRunWarning.hidden = dryRunEl.checked;
}

restoreSettings();
updateCustomNameRow(false);
refreshCustomNameFeedback();
refreshFileLimitFeedback();
refreshExtensionFilter();
refreshDryRunWarning();
refreshRunButton();

function appendLog(entry: LogEntry): void {
  const wasNearBottom =
    logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight < 24;
  const empty = logEl.querySelector(".log-empty");
  if (empty) empty.remove();

  const line = document.createElement("div");
  line.className = `log-line ${entry.level || "info"}`;
  line.textContent = entry.message;
  logEl.appendChild(line);
  if (wasNearBottom) {
    logEl.scrollTop = logEl.scrollHeight;
  }
}

function clearLog(): void {
  logEl.innerHTML =
    '<div class="log-empty">Logs will appear here once you run.</div>';
}

function setRunning(running: boolean): void {
  // Keep the document scrollable, but prevent any action from being changed
  // while the worker is processing the current immutable options snapshot.
  isRunning = running;
  document.body.classList.toggle("is-running", running);
  appMainEl.setAttribute("aria-busy", String(running));
  runBtn.disabled = running;
  cancelBtn.hidden = !running;
  cancelBtn.disabled = !running;
  cancelBtn.textContent = "Cancel safely";
  selectBtn.disabled = running;
  clearBtn.disabled = running;
  websiteLinkBtn.disabled = running;
  versionPill.disabled = running || !updateReleaseUrl;
  customInput.disabled = running;
  dryRunEl.disabled = running;
  organizeYearMonthEl.disabled = running;
  scanSubfoldersEl.disabled = running;
  extensionModeEl.disabled = running;
  customExtensionsEl.disabled = running;
  fileLimitEl.disabled = running || unlimitedFilesEl.checked;
  unlimitedFilesEl.disabled = running;
  modeInputs.forEach((input) => {
    input.disabled = running;
  });
  runBtn.textContent = running ? "Organizing…" : "Organize folder";
  if (!running) refreshRunButton();
}

function resetProgress(): void {
  progressEl.hidden = false;
  progressBarEl.removeAttribute("value");
  progressBarEl.max = 1;
  progressLabelEl.textContent = "Scanning supported files…";
  progressCountEl.textContent = "";
  progressFileEl.textContent = "";
}

function clearProgress(): void {
  progressEl.hidden = true;
  progressBarEl.removeAttribute("value");
  progressBarEl.max = 1;
  progressLabelEl.textContent = "Preparing…";
  progressCountEl.textContent = "";
  progressFileEl.textContent = "";
}

function updateProgress(progress: OrganizeProgress): void {
  progressEl.hidden = false;

  if (progress.phase === "scanning") {
    progressBarEl.removeAttribute("value");
    progressLabelEl.textContent = "Scanning supported files…";
    progressCountEl.textContent = "";
    progressFileEl.textContent = "";
    return;
  }

  progressBarEl.max = Math.max(progress.total, 1);
  progressBarEl.value = progress.processed;
  progressCountEl.textContent = `${progress.processed} of ${progress.total}`;
  progressFileEl.textContent = progress.currentFile ?? "";
  progressLabelEl.textContent =
    progress.phase === "done"
      ? "Run complete"
      : progress.phase === "cancelled"
        ? "Run cancelled safely"
        : "Organizing files…";
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
