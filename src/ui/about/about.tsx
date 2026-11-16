import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { buildInfo, CORTEX_REPO, releaseUrl, THREVA_REPO, type BuildInfo } from "./build-info";

export function AboutPanel({ info = buildInfo }: { info?: BuildInfo }) {
  const { t } = useI18n();
  return (
    <div className="about-panel" id="about-panel" role="region" aria-label={t("about.title")}>
      <dl>
        <dt>{t("about.threva")}</dt>
        <dd>{info.threvaTag
          ? <a href={releaseUrl(THREVA_REPO, info.threvaTag)} target="_blank" rel="noreferrer">{info.threvaTag}</a>
          : <>{t("about.devBuild")} <a href={THREVA_REPO} target="_blank" rel="noreferrer">{THREVA_REPO}</a></>}</dd>
        <dt>{t("about.cortex")}</dt>
        <dd>{info.cortexTag
          ? <a href={releaseUrl(CORTEX_REPO, info.cortexTag)} target="_blank" rel="noreferrer">{info.cortexTag}</a>
          : <>{t("about.devBuild")} <a href={CORTEX_REPO} target="_blank" rel="noreferrer">{CORTEX_REPO}</a></>}</dd>
        <dt>{t("about.source")}</dt>
        <dd>{info.sourceDir ? <code>{info.sourceDir}</code> : t("about.devBuild")}</dd>
      </dl>
    </div>
  );
}

export function About({ info }: { info?: BuildInfo }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    const onPointer = (event: MouseEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);
  return (
    <div className="about" ref={root}>
      <button type="button" className="about-toggle" aria-expanded={open} onClick={() => { setOpen(value => !value); }}>{t("about.title")}</button>
      {open && <AboutPanel info={info} />}
    </div>
  );
}
