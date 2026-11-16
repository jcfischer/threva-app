export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function isNtfyTopicUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && /^\/[A-Za-z0-9_-]+$/.test(url.pathname);
  } catch {
    return false;
  }
}
