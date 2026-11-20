import type { DESK_API_VERSION } from "@the-metafactory/cortex/desk-api";

type Major<V extends string> = V extends `${infer M}.${string}` ? M : never;

export const DESK_API_MAJOR: Major<typeof DESK_API_VERSION> = "1";

export const sameDeskApiMajor = (version: string): boolean => version.split(".")[0] === DESK_API_MAJOR;
