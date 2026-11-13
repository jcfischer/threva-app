/* Shared by the explore page (build.ts) and the guided test (build-try.ts): the German core with the prototype's */
/* wording, the one-card layout, the inbox, the client shell and the styles. */
const here = import.meta.dir;
const page = `${here}/../page`;

/* Wording that differs from the first test page. Each string must exist exactly once, so a change in the core fails the build. */
const RENAME: [string, string][] = [
  ['placeholder="Eine Aufgabe, ein Gedanke, eine Entscheidung"', 'placeholder="Was aus diesem Termin bleibt, zum Beispiel eine Aufgabe"'],
  ["Abgegebenes ansehen", "Delegiertes ansehen"],
  ['"Abgegeben. Es kommt wieder nach oben', '"Delegiert. Es kommt wieder nach oben'],
];

export async function bundle(): Promise<{ script: string; css: string }> {
  let core = await Bun.file(`${page}/core.de.js`).text();
  /* Notieren instead of Festhalten in the core's wording as well. */
  for (const [re, to] of [[/festzuhalten/g, "zu notieren"], [/Festgehalten/g, "Notiert"], [/festgehalten/g, "notiert"], [/Festhalten/g, "Notieren"], [/festhalten/g, "notieren"]] as [RegExp, string][]) core = core.replace(re, to);
  for (const [from, to] of RENAME) {
    const n = core.split(from).length - 1;
    if (n !== 1) throw new Error(`core.de.js: expected one "${from}", found ${n}`);
    core = core.replace(from, to);
  }
  const [one, inbox, studio, shell, base] = await Promise.all(
    ["one.de.js", "inbox.de.js", "studio.de.js", "shell.js"].map((f) => Bun.file(`${here}/${f}`).text()).concat(Bun.file(`${page}/base.css`).text()),
  );
  const script = `const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function oneCore() {
${core}
${one}
${inbox}
${studio}
  return { isQuestion, setWhy(m) { WHY = m; }, setStudio(on, layout) { STUDIO_ON = on; if (layout) SLAYOUT = layout; }, sigInit, setPhase(p) { PHASE = p; }, studioOne, studioAct, oneAct, oneSuggest, loadScenario, SCENARIO_LIST, setSlots(n) { SLOTS = n; }, get U() { return U; } };
}
${shell}`;
  return { script, css: base + EXTRA };
}

const EXTRA = `
html{color-scheme:light dark}body{margin:0;font-size:14px}[hidden]{display:none!important}
.bar1{position:relative}
.bar1 input{width:100%;font-size:17px;padding:13px 14px;border:1.5px solid var(--accent);border-radius:10px;box-sizing:border-box}
.sugg{position:absolute;top:100%;left:0;right:0;z-index:20;display:flex;flex-direction:column;border:1px solid var(--line);border-top:0;border-radius:0 0 10px 10px;background:var(--panel);margin-top:-4px;overflow:hidden;box-shadow:0 10px 24px rgba(0,0,0,.14)}
.interrupt{display:flex;flex-direction:column;gap:5px;border:1.5px solid var(--warn,#c77d00);border-radius:10px;padding:12px 14px;background:var(--panel)}
.say{display:flex;flex-direction:column;gap:8px;min-width:0}
.say p{margin:0}
.chatlist{margin:0}
.chatlist li{display:flex;flex-direction:column;gap:2px;margin:6px 0}
.chatlist strong{font-weight:600;color:var(--text,inherit)}
.studio{border-color:var(--accent);gap:14px}
.stcrumbs{gap:6px;flex-wrap:wrap}
.stq{margin:2px 0 0;font-size:20px;max-width:60ch}
.ststand{border-left:3px solid var(--accent);padding:4px 0 4px 12px}
.ststand p{margin:4px 0 0;font-size:15px}
.stspar{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.stnote{border:1px solid var(--line);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:6px}
.stnote p{margin:0}
.stnote.stand{border-color:var(--accent)}
.stnote.gone{opacity:.5}
.stnote.thinking{border-style:dashed}
.stmain{display:flex;flex-direction:column;gap:14px;min-width:0}
.stgrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,280px);gap:22px;align-items:start}
@media (max-width:900px){.stgrid{grid-template-columns:minmax(0,1fr)}}
.stside{display:flex;flex-direction:column;gap:14px;min-width:0}
.stbelow{border-top:1px solid var(--line);padding-top:12px}
.stbelow .stside{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}
.strel{display:flex;flex-direction:column;gap:5px;align-items:flex-start}
.strel .lk,.stnote .lk{background:none;border:0;padding:0;color:var(--accent);text-decoration:underline;text-underline-offset:3px;font:inherit;cursor:pointer;text-align:left}
.barlabel{display:block;font-size:13px;color:var(--dim);margin-bottom:6px}
.whyline{display:flex;gap:12px;align-items:baseline;justify-content:space-between;flex-wrap:wrap;font-size:13px;color:var(--dim);padding:0 2px 4px}
.whyline b{font-weight:600;color:var(--text,inherit)}
.whypanel{border:1px dashed var(--line);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:6px;margin-bottom:8px}
.toast .lk{background:none;border:0;padding:0;color:inherit;text-decoration:underline;font:inherit;font-weight:600;cursor:pointer}
.kept{margin:0}
.kept li{color:var(--ok,#1a7f37);font-weight:500}
.chatlist .row{margin-top:4px}
.keyhint{display:flex;gap:14px;align-items:center;color:var(--dim);font-size:12.5px}
.keyhint kbd{font:inherit;font-size:11.5px;border:1px solid var(--line);border-bottom-width:2px;border-radius:4px;padding:0 5px;background:var(--panel)}
.sugg button{display:flex;justify-content:space-between;gap:12px;padding:9px 14px;border:0;border-top:1px solid var(--line);background:transparent;text-align:left;color:inherit;font:inherit;cursor:pointer}
.sugg button:hover{background:var(--panel-2,var(--accent-soft))}
.sugg button.sg-on{background:var(--accent-soft);box-shadow:inset 3px 0 0 var(--accent)}
.sugg button.sg-on>span:first-child::before{content:"↵ "}
.sugg:empty{display:none}
.nextline{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:baseline}
.slotcard{display:flex;flex-direction:column;gap:4px}
.slotcard>.card{border-color:var(--accent)}
@media (max-width:900px){.daygrid.one .rail{order:1}}
.nextline .lk,.card .lk{background:none;border:0;padding:0;color:var(--accent);text-decoration:underline;text-underline-offset:3px;font:inherit;cursor:pointer;text-align:left}
.proto-ctl{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center}
`;
