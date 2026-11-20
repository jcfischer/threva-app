import type { ActError } from "../cards/act";
import { useI18n } from "../i18n";
import { draftConflict } from "./draft";

export function DraftChanged({ error }: { error: ActError }) {
  const { t } = useI18n();
  const conflict = draftConflict(error?.body);
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
