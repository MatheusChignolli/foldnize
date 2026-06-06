import type {
  LogEntry,
  OrganizeOptions,
  OrganizeSummary,
} from "foldnize";

export interface FolderSelection {
  path: string;
  entryCount: number;
}

export type OrganizeResponse =
  | { ok: true; summary: OrganizeSummary }
  | { ok: false; error: string };

export interface FoldnizeBridge {
  platform: string;
  selectFolder: () => Promise<FolderSelection | null>;
  organize: (options: OrganizeOptions) => Promise<OrganizeResponse>;
  sanitizeCustomName: (raw: string) => string;
  openExternal: (url: string) => Promise<void>;
  onLog: (callback: (entry: LogEntry) => void) => () => void;
}
