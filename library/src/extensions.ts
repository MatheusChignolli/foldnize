import { VALID_EXTENSIONS } from "./naming";

export enum ExtensionFilterMode {
  DEFAULT = "default",
  ONLY = "only",
  EXTEND = "extend",
}

export interface ExtensionFilterOptions {
  /** Defaults to `default`. */
  mode?: ExtensionFilterMode;
  /** Extensions with or without a leading dot, for example `["raw", ".gif"]`. */
  extensions?: readonly string[];
}

const VALID_EXTENSION_PATTERN = /^\.[a-z0-9][a-z0-9_+-]*$/;

export function normalizeCustomExtensions(
  extensions: readonly string[],
): string[] {
  if (!Array.isArray(extensions)) {
    throw new Error("extensions must be an array of file extensions.");
  }

  const normalized = new Set<string>();
  for (const extension of extensions) {
    if (typeof extension !== "string") {
      throw new Error("Each extension must be a string.");
    }

    const trimmed = extension.trim().toLowerCase();
    const value = trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
    if (!VALID_EXTENSION_PATTERN.test(value)) {
      throw new Error(
        `Invalid extension: "${extension}". Use values such as "jpg" or ".raw".`,
      );
    }
    normalized.add(value);
  }

  return [...normalized].sort();
}

export function parseExtensionList(input: string): string[] {
  if (typeof input !== "string") {
    throw new Error("Extension list must be a comma-separated string.");
  }

  return normalizeCustomExtensions(
    input
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export function resolveExtensionFilter(
  filter?: ExtensionFilterOptions,
): ReadonlySet<string> {
  const mode = filter?.mode ?? ExtensionFilterMode.DEFAULT;
  if (!Object.values(ExtensionFilterMode).includes(mode)) {
    throw new Error(
      'extensionFilter.mode must be "default", "only", or "extend".',
    );
  }

  if (mode === ExtensionFilterMode.DEFAULT) {
    return new Set(VALID_EXTENSIONS);
  }

  const custom = normalizeCustomExtensions(filter?.extensions ?? []);
  if (custom.length === 0) {
    throw new Error(
      `extensionFilter.extensions requires at least one extension in "${mode}" mode.`,
    );
  }

  return mode === ExtensionFilterMode.ONLY
    ? new Set(custom)
    : new Set([...VALID_EXTENSIONS, ...custom]);
}
