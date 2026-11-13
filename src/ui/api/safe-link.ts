const ALLOWED = new Set(["http:", "https:", "message:"]);

export function safeHref(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  try {
    return ALLOWED.has(new URL(url).protocol) ? url : undefined;
  } catch {
    return undefined;
  }
}
