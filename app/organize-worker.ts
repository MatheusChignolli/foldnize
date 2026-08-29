import { parentPort, workerData } from "node:worker_threads";

import {
  configureMetadataTools,
  organizeFolder,
  type LogEntry,
  type MetadataToolPaths,
  type OrganizeOptions,
  type OrganizeProgress,
} from "foldnize";

import type { OrganizeResponse } from "./bridge-types";

export interface OrganizeWorkerInput {
  options: OrganizeOptions;
  metadataTools?: MetadataToolPaths;
  cancelBuffer: SharedArrayBuffer;
}

export type OrganizeWorkerMessage =
  | { type: "log"; entry: LogEntry }
  | { type: "progress"; progress: OrganizeProgress }
  | { type: "result"; response: OrganizeResponse };

const port = parentPort;
if (!port) {
  throw new Error("The organization worker requires a parent port.");
}

const input = workerData as OrganizeWorkerInput;
const cancelView = new Int32Array(input.cancelBuffer);

try {
  if (input.metadataTools) {
    configureMetadataTools(input.metadataTools);
  }

  const summary = organizeFolder({
    ...input.options,
    onLog: (entry) => {
      port.postMessage({ type: "log", entry } satisfies OrganizeWorkerMessage);
    },
    onProgress: (progress) => {
      port.postMessage({
        type: "progress",
        progress,
      } satisfies OrganizeWorkerMessage);
    },
    shouldCancel: () => Atomics.load(cancelView, 0) === 1,
  });

  port.postMessage({
    type: "result",
    response: { ok: true, summary },
  } satisfies OrganizeWorkerMessage);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  port.postMessage({
    type: "log",
    entry: { level: "error" as LogEntry["level"], message },
  } satisfies OrganizeWorkerMessage);
  port.postMessage({
    type: "result",
    response: { ok: false, error: message },
  } satisfies OrganizeWorkerMessage);
}
