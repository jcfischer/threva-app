declare const THREVA_SOURCE_DIR: string | undefined;
declare const CORTEX_TAG: string | undefined;
declare const THREVA_TAG: string | undefined;

export interface BuildInfo {
  readonly sourceDir: string | null;
  readonly threvaTag: string | null;
  readonly cortexTag: string | null;
}

const present = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === "" ? null : trimmed;
};

export const buildInfo: BuildInfo = {
  sourceDir: present(typeof THREVA_SOURCE_DIR === "undefined" ? undefined : THREVA_SOURCE_DIR),
  threvaTag: present(typeof THREVA_TAG === "undefined" ? undefined : THREVA_TAG),
  cortexTag: present(typeof CORTEX_TAG === "undefined" ? undefined : CORTEX_TAG),
};

export const THREVA_REPO = "https://github.com/jcfischer/threva-app";
export const CORTEX_REPO = "https://github.com/the-metafactory/cortex";

export const releaseUrl = (repo: string, tag: string): string => `${repo}/releases/tag/${encodeURIComponent(tag)}`;
