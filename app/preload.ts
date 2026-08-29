import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

import type {
  FolderSelection,
  FoldnizeBridge,
  OrganizeResponse,
  UpdateInfo,
} from "./bridge-types";
import { parseExtensionList, sanitizeCustomName } from "foldnize";
import type { LogEntry, OrganizeOptions, OrganizeProgress } from "foldnize";

const bridge: FoldnizeBridge = {
  platform: process.platform,

  checkForUpdate: (): Promise<UpdateInfo> =>
    ipcRenderer.invoke("app:checkForUpdate"),

  selectFolder: (): Promise<FolderSelection | null> =>
    ipcRenderer.invoke("dialog:selectFolder"),

  organize: (options: OrganizeOptions): Promise<OrganizeResponse> =>
    ipcRenderer.invoke("organize:run", options),

  cancelOrganization: (): Promise<boolean> =>
    ipcRenderer.invoke("organize:cancel"),

  sanitizeCustomName: (raw: string): string => sanitizeCustomName(raw),

  parseExtensionList: (raw: string): string[] => parseExtensionList(raw),

  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke("shell:openExternal", url),

  onLog: (callback: (entry: LogEntry) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, entry: LogEntry): void => {
      callback(entry);
    };
    ipcRenderer.on("organize:log", listener);
    return () => {
      ipcRenderer.removeListener("organize:log", listener);
    };
  },

  onProgress: (
    callback: (progress: OrganizeProgress) => void,
  ): (() => void) => {
    const listener = (
      _event: IpcRendererEvent,
      progress: OrganizeProgress,
    ): void => {
      callback(progress);
    };
    ipcRenderer.on("organize:progress", listener);
    return () => {
      ipcRenderer.removeListener("organize:progress", listener);
    };
  },
};

contextBridge.exposeInMainWorld("foldnize", bridge);
