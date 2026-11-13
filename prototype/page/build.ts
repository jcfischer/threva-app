const here = import.meta.dir;
const guide = await Bun.file(`${here}/guide.js`).text();
const css = await Bun.file(`${here}/base.css`).text();
const API = `
  return { studio, studioAct, loadScenario, SCENARIO_LIST, ust, get PACK() { return PACK; }, get U() { return U; }, get CAL() { return CAL; }, get U_PROJ() { return U_PROJ; }, setNames(a, t) { A_NAME = a; T_NAME = t; } };`;
async function wrap(file: string, name: string) {
  let c = await Bun.file(`${here}/${file}`).text();
  const before = (c.match(/document\.addEventListener\(/g) || []).length;
  let n = 0;
  c = c.replace(/document\.addEventListener\("(\w+)", \((e?)\) => \{/g, (_m, ev, e) => { n++; return `document.addEventListener("${ev}", (${e}) => { if (!__active()) return;`; });
  if (n !== before || n === 0) throw new Error(`${file}: guarded ${n} of ${before} listeners`);
  return `function ${name}(__active) {\n${c}\n${API}\n}\n`;
}
const extra = `
body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:10;background:var(--bg)}
#guide{position:sticky;top:env(safe-area-inset-top,0px);z-index:5}
.guide{background:var(--panel);border:1.5px solid var(--accent);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:10px;box-shadow:0 0 0 5px var(--bg);max-height:62vh;overflow:auto}
.gtask{font-size:16px;font-weight:500;max-width:72ch}
.guide textarea{min-height:56px}
#view > div > section{display:none}
.scn{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
@media (max-width:560px){.scn{grid-template-columns:minmax(0,1fr)}}
.scn .card[aria-checked="true"]{border-color:var(--accent);background:var(--accent-soft)}
.seg button[role="radio"][aria-checked="true"]{background:var(--accent);color:var(--on-accent)}
`;
const page = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>Threva · Probelauf · Test run</title>
<style>
html{color-scheme:light dark}body{margin:0;font-size:14px}img{max-width:100%}[hidden]{display:none!important}
${css}${extra}</style>
</head>
<body>

<div class="wrap" id="wrap">
  <header style="display:flex;flex-direction:column;gap:6px">
    <span class="eyebrow" id="hd-eyebrow">Threva · Prototyp · prototype</span>
    <h1 id="hd-title">Threva</h1>
  </header>
  <div id="guide" hidden></div>
  <main id="view"></main>
</div>

<script>
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
${await wrap("core.de.js", "coreDE")}
${await wrap("core.en.js", "coreEN")}
${guide}</script>
</body>
</html>
`;
await Bun.write(`${here}/../public/index.html`, page);
console.log("bytes", page.length);
