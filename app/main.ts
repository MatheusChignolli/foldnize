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
