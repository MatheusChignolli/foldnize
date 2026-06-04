import type { FoldnizeBridge } from "./bridge-types";

declare global {
  interface Window {
    foldnize: FoldnizeBridge;
  }
}

export {};
