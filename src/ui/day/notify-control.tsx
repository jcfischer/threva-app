import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import type { Notifier } from "../queue/notifier";

export function NotifyControl({ notifier }: { notifier: Notifier }) {
  const { t } = useI18n();
  const [permission, setPermission] = useState(() => notifier.permission());
  const inFlight = useRef(false);
  useEffect(() => {
    const read = () => setPermission(notifier.permission());
    window.addEventListener("focus", read);
    document.addEventListener("visibilitychange", read);
    return () => {
      window.removeEventListener("focus", read);
      document.removeEventListener("visibilitychange", read);
    };
  }, [notifier]);
  if (permission !== "default") return null;
  const request = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try { setPermission(await notifier.requestPermission()); }
    finally { inFlight.current = false; }
  };
  return <button type="button" className="btn quiet" onClick={() => void request()}>{t("interrupt.notify")}</button>;
}
