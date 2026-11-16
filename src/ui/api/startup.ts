import { useEffect, useState } from "react";
import type { DeskClient } from "./client";
import { DESK_API_MAJOR, sameDeskApiMajor } from "./desk-version";

export type Startup =
  | { state: "checking" }
  | { state: "ready" }
  | { state: "failed"; message: string | null }
  | { state: "refused"; built: string; found: string };

export function useStartup(client: DeskClient): Startup {
  const [startup, setStartup] = useState<Startup>({ state: "checking" });
  useEffect(() => {
    let live = true;
    void client.handshake().then((answer) => {
      if (!live) return;
      if (!answer.ok) {
        setStartup({ state: "failed", message: answer.message });
        return;
      }
      const found = answer.data.version;
      setStartup(sameDeskApiMajor(found) ? { state: "ready" } : { state: "refused", built: DESK_API_MAJOR, found });
    });
    return () => {
      live = false;
    };
  }, [client]);
  return startup;
}
