import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  nativeImage,
  shell,
} from "electron";
import path from "node:path";
import fs from "node:fs";

import { organizeFolder } from "foldnize";
import type {
  FolderSelection,
  OrganizeResponse,
  UpdateInfo,
} from "./bridge-types";
import type {
  LogEntry,
  LogLevel,
  OrganizeOptions,
} from "foldnize";

// macOS shows "Electron" in the Dock tooltip unless the app name is set
// before the ready event (dev mode uses Electron's bundle name by default).
app.setName("Foldnize");

let mainWindow: BrowserWindow | null = null;

const RELEASES_URL =
  "https://api.github.com/repos/MatheusChignolli/foldnize/releases?per_page=20";
const RELEASE_TAG_PREFIX = "foldnize-app-v";

interface GitHubRelease {
  tag_name?: unknown;
  html_url?: unknown;
  draft?: unknown;
  prerelease?: unknown;
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }

  return 0;
}

async function checkForUpdate(): Promise<UpdateInfo> {
  const currentVersion = app.getVersion();
  const fallback: UpdateInfo = {
    currentVersion,
    latestVersion: null,
    updateAvailable: false,
    releaseUrl: null,
  };

  try {
    const response = await fetch(RELEASES_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": `Foldnize/${currentVersion}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) return fallback;

    const releases = (await response.json()) as GitHubRelease[];
    const release = releases.find(
      (candidate) =>
        candidate.draft !== true &&
        candidate.prerelease !== true &&
        typeof candidate.tag_name === "string" &&
        candidate.tag_name.startsWith(RELEASE_TAG_PREFIX) &&
        typeof candidate.html_url === "string",
    );

    if (
      !release ||
      typeof release.tag_name !== "string" ||
      typeof release.html_url !== "string"
    ) {
      return fallback;
    }

    const latestVersion = release.tag_name.slice(RELEASE_TAG_PREFIX.length);
    if (!/^\d+(?:\.\d+){1,2}$/.test(latestVersion)) return fallback;

    return {
      currentVersion,
      latestVersion,
      updateAvailable: compareVersions(latestVersion, currentVersion) > 0,
      releaseUrl: release.html_url,
    };
  } catch {
    return fallback;
  }
}

function setDockIcon(): void {
  // Packaged macOS apps get their icon from the bundle. Overriding it at
  // runtime replaces the modern Icon Composer asset with a flat legacy image.
  if (process.platform !== "darwin" || app.isPackaged || !app.dock) return;

  const assetsDir = path.join(__dirname, "assets");
  const icnsPath = path.join(assetsDir, "icon.icns");
  const pngPath = path.join(assetsDir, "icon.png");
  const iconPath = fs.existsSync(icnsPath) ? icnsPath : pngPath;
  if (!fs.existsSync(iconPath)) return;

  try {
    const image = nativeImage.createFromPath(iconPath);
    if (!image.isEmpty()) {
      app.dock.setIcon(image);
    }
  } catch {
    // ignore — falls back to the default Electron icon
  }
}

function createWindow(): void {
  const isMac = process.platform === "darwin";

  mainWindow = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 720,
    minHeight: 540,
    backgroundColor: "#0f1115",
    title: "Foldnize",
    titleBarStyle: isMac ? "hiddenInset" : "default",
    trafficLightPosition: isMac ? { x: 22, y: 30 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  setDockIcon();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle(
  "shell:openExternal",
  async (_event, url: string): Promise<void> => {
    await shell.openExternal(url);
  },
);

ipcMain.handle("app:checkForUpdate", checkForUpdate);

ipcMain.handle(
  "dialog:selectFolder",
  async (event): Promise<FolderSelection | null> => {
    const parent = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
    if (!parent) return null;

    const result = await dialog.showOpenDialog(parent, {
      title: "Select a folder to organize",
      properties: ["openDirectory", "createDirectory"],
      buttonLabel: "Select folder",
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const folderPath = result.filePaths[0]!;

    let entryCount = 0;
    try {
      entryCount = fs.readdirSync(folderPath).length;
    } catch {
      entryCount = 0;
    }

    return { path: folderPath, entryCount };
  },
);

ipcMain.handle(
  "organize:run",
  async (event, options: OrganizeOptions): Promise<OrganizeResponse> => {
    const sendLog = (entry: LogEntry): void => {
      event.sender.send("organize:log", entry);
    };

    try {
      const summary = organizeFolder({
        ...options,
        onLog: sendLog,
      });

      return { ok: true, summary };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendLog({ level: "error" as LogLevel, message });
      return { ok: false, error: message };
    }
  },
);
