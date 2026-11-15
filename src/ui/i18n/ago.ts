import type { I18n } from "./index";

const MINUTE = 60_000;

/** How long ago a time was, in the shortest words the catalog has: "just now", "12 min ago", "3 h ago", "2 d ago". */
export function ago(i18n: Pick<I18n, "t">, at: string, now: number): string {
  const ms = now - Date.parse(at);
  if (Number.isNaN(ms)) return at;
  const minutes = Math.max(0, Math.floor(ms / MINUTE));
  if (minutes < 1) return i18n.t("ago.now");
  if (minutes < 60) return i18n.t("ago.m", { n: minutes });
  if (minutes < 60 * 24) return i18n.t("ago.h", { n: Math.floor(minutes / 60) });
  return i18n.t("ago.d", { n: Math.floor(minutes / 60 / 24) });
}
