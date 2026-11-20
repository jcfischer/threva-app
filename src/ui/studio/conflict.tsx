import type { ActError } from "../cards/act";
import { useI18n } from "../i18n";

export interface DraftConflict {
  text: string;
  revision: string;
}

/** Cortex's 409 for a park or close whose thread moved on: the draft as it is now, and its revision. */
export function draftConflict(error: ActError): DraftConflict | null {
  const body = error?.body;
  if (!body || typeof body !== "object") return null;
  const fields = body as { text?: unknown; revision?: unknown };
  if (typeof fields.text !== "string" || typeof fields.revision !== "string") return null;
  return { text: fields.text, revision: fields.revision };
}

export function DraftChanged({ error }: { error: ActError }) {
  const { t } = useI18n();
  const conflict = draftConflict(error);
  if (!conflict) return null;
  return (
    <div className="stack" data-desk-draft="changed">
      <span role="alert">{t("desk.draft.changed")}</span>
      <pre className="note" data-desk-draft-text={conflict.revision}>
        {conflict.text.trim() ? conflict.text : t("desk.draft.empty")}
      </pre>
      <span className="faint">{t("desk.draft.revision", { revision: conflict.revision })}</span>
    </div>
  );
}
