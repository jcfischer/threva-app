export const DEFAULT_CORTEX_ORIGIN = "http://127.0.0.1:8767";

export function cortexUrl(path: string, origin: string = DEFAULT_CORTEX_ORIGIN): string {
  if (!path.startsWith("/api/")) throw new Error(`Not a Cortex API path: ${path}`);
  return new URL(path, origin).toString();
}
