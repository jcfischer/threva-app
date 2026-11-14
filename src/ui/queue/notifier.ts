import type { DeskItem } from "../api/types";
import { isInterrupting } from "./order";

export type NotifyPermission = NotificationPermission | "unavailable";

export interface Notifier {
  permission(): NotifyPermission;
  requestPermission(): Promise<NotifyPermission>;
  hidden(): boolean;
  notify(item: { key: string; title: string; why: string }, onClick: () => void): void;
  focus(): void;
}

export function browserNotifier(): Notifier {
  const api = () => typeof window !== "undefined" ? window.Notification : undefined;
  return {
    permission: () => api()?.permission ?? "unavailable",
    requestPermission: async () => {
      try { return await api()?.requestPermission() ?? "unavailable"; }
      catch { return api()?.permission ?? "unavailable"; }
    },
    hidden: () => typeof document !== "undefined" && document.visibilityState === "hidden",
    notify: (item, onClick) => {
      const NotificationApi = api();
      if (!NotificationApi) return;
      const notification = new NotificationApi(item.title, { body: item.why, tag: item.key });
      notification.onclick = () => {
        notification.close();
        onClick();
      };
    },
    focus: () => window.focus(),
  };
}

// One watcher per mounted App: a successful first load is a quiet baseline. A held
// item is not seen as an interruption until Cortex releases it on a later poll.
export function interruptionWatcher(notifier: Notifier, onOpen: (key: string) => void) {
  const seen = new Set<string>();
  let loaded = false;
  return (items: readonly DeskItem[]) => {
    for (const item of items) {
      if (item.interrupt?.delivery === "held" || seen.has(item.key)) continue;
      seen.add(item.key);
      if (!loaded || !isInterrupting(item) || !notifier.hidden() || notifier.permission() !== "granted") continue;
      try {
        notifier.notify(item, () => {
          notifier.focus();
          onOpen(item.key);
        });
      } catch {
        // A browser may expose the API but refuse construction (for example on mobile).
      }
    }
    loaded = true;
  };
}
