import type { ReactNode } from "react";
import { useI18n } from "../i18n";
import type { ActError } from "./act";

export function Card({ eyebrow, pill, children }: { eyebrow: string; pill?: ReactNode; children: ReactNode }) {
  return (
    <div className="card">
      <span className="row" style={{ justifyContent: "space-between" }}>
        <span className="eyebrow">{eyebrow}</span>
        {pill}
      </span>
      {children}
    </div>
  );
}

export function ErrorLine({ error }: { error: ActError }) {
  const { t } = useI18n();
  if (!error) return null;
  return (
    <span className="faint" role="alert">
      {error.message ?? t("error.network")}
    </span>
  );
}
