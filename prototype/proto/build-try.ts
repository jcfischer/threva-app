/* Guided test, second version: builds ../public/index.html, the page the Worker serves on try.threva.work. */
import { bundle } from "./compose";
const here = import.meta.dir;
const { script, css } = await bundle();
const guide = await Bun.file(`${here}/guide.de.js`).text();

const guideCss = `
body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:10;background:var(--bg)}
#guide{position:sticky;top:env(safe-area-inset-top,0px);z-index:5}
.guide{background:var(--panel);border:1.5px solid var(--accent);border-radius:12px;padding:12px 16px;display:flex;flex-direction:column;gap:9px;box-shadow:0 0 0 5px var(--bg);max-height:50vh;overflow:auto}
.gdone{margin:0;font-weight:600;color:var(--ok,#1a7f37)}
.gtask{font-size:16px;font-weight:500;max-width:72ch;margin:0}
.guide textarea{min-height:52px}
.seg button[role="radio"][aria-checked="true"]{background:var(--accent);color:var(--on-accent)}
`;

const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>Threva · Probelauf</title>
<style>${css}${guideCss}</style>
</head>
<body>
<div class="wrap">
  <header style="display:flex;flex-direction:column;gap:6px">
    <span class="eyebrow">Threva · Prototyp · alle Daten sind erfunden</span>
    <h1>Eine Sache nach der anderen</h1>
  </header>
  <div id="guide" hidden></div>
  <main id="view"></main>
</div>
<script>
${script}
${guide}
</script>
</body>
</html>
`;
await Bun.write(`${here}/../public/index.html`, html);
console.log("bytes", html.length);
