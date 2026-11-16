import { useEffect, useState } from "react";
import type { DeskClient } from "@desk/client";
import { DESK_API_MAJOR, sameDeskApiMajor } from "@desk/desk-version";
import type { Startup } from "@desk/startup";
import { useI18n } from "../i18n";
import { POLL_MS } from "./use-desk";

export function useStartup(client: DeskClient, retryMs: number = POLL_MS): Startup {
  const { t } = useI18n();
  const [startup, setStartup] = useState<Startup>({ state: "checking" });
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      void client.contract().then((answer) => {
        if (!live) return;
        if (answer.ok) {
          const found: unknown = answer.data.version;
          if (typeof found === "string") {
            setStartup(sameDeskApiMajor(found) ? { state: "ready" } : { state: "refused", built: DESK_API_MAJOR, found });
            return;
          }
          setStartup({ state: "failed", message: t("startup.contract") });
        } else {
          setStartup({ state: "failed", message: answer.status === 0 ? answer.message : (answer.message ?? t("startup.contract")) });
        }
        timer = setTimeout(check, retryMs);
      });
    };
    check();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [client, retryMs, t]);
  return startup;
}
