import { useState } from "react";
import type { DeskView } from "../api/types";
import { useI18n } from "../i18n";
import { isMailItem } from "../queue/order";
import { formatLength } from "./timeline-view";

const LINE = { gridTemplateColumns: "minmax(0,1fr)" } as const;

function InboxLine({ view }: { view: DeskView }) {
  const { t, tn } = useI18n();
  const mails = view.items.filter(isMailItem).length;
  const groups = (view.mailSweeps?.length ?? 0) + (view.mailDigests?.length ?? 0);
  return (
    <div className="slot" style={LINE}>
      <span>
        <b>{t("footer.inbox")}</b>{" "}
        <span className="faint">{mails === 0 && groups === 0 ? t("footer.inbox.clear") : `${tn("footer.inbox.mails", mails)} · ${tn("footer.inbox.groups", groups)}`}</span>
      </span>
    </div>
  );
}

function RoutinesLine({ routines }: { routines: NonNullable<DeskView["routines"]> }) {
  const { t, tn } = useI18n();
  return (
    <div className="slot" style={LINE}>
      <span>
        <b>{t("footer.routines")}</b>{" "}
        <span className="faint">
          {tn("footer.routines.installed", routines.installed.length)} · {tn("footer.routines.pending", routines.pending.length)}
        </span>
      </span>
    </div>
  );
}

function DelegatedLine({ agents, now, defaultOpen }: { agents: NonNullable<DeskView["agents"]>; now: number; defaultOpen: boolean }) {
  const i18n = useI18n();
  const { t } = i18n;
  const [open, setOpen] = useState(defaultOpen);
  const list = agents.working.length > 0;
  return (
    <div className="slot" style={LINE}>
      <span>
        <b>{t("footer.delegated")}</b> <span className="faint">{agents.line}</span>
      </span>
      {list && (
        <button type="button" className="btn quiet" aria-expanded={open} onClick={() => setOpen(!open)} style={{ justifySelf: "start", paddingLeft: 0 }}>
          {open ? t("footer.delegated.hide") : t("footer.delegated.show")}
        </button>
      )}
      {list && open && (
        <ul className="plain">
          {agents.working.map((w) => (
            <li key={`${w.title}:${w.since}`}>
              <b>{w.title}</b> <span className="faint">{[w.note, t("footer.delegated.since", { length: formatLength(i18n, now - w.since) })].filter(Boolean).join(" · ")}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Footer({ view, now, defaultOpen = false }: { view: DeskView; now?: number; defaultOpen?: boolean }) {
  return (
    <section className="rail">
      <InboxLine view={view} />
      {view.routines && <RoutinesLine routines={view.routines} />}
      {view.agents && <DelegatedLine agents={view.agents} now={now ?? Date.now()} defaultOpen={defaultOpen} />}
    </section>
  );
}
