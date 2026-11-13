/* Explore page: the prototype with its switches, no guide. Builds dist/index.html. The guided test is build-try.ts. */
import { bundle } from "./compose";
const here = import.meta.dir;
const { script, css } = await bundle();

const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>Threva · Eine Karte</title>
<style>${css}</style>
</head>
<body>
<div class="wrap">
  <header style="display:flex;flex-direction:column;gap:10px">
    <span class="eyebrow">Threva · Prototyp · alle Daten sind erfunden</span>
    <div class="proto-ctl">
      <span class="row"><span class="faint">Karten offen</span><div class="seg" role="tablist" id="ctl-slots"><button role="tab" data-n="1" aria-selected="true">Eine</button><button role="tab" data-n="2" aria-selected="false">Zwei</button></div></span>
      <span class="row"><span class="faint">Eingang</span><div class="seg" role="tablist" id="ctl-phase"><button role="tab" data-p="learn" aria-selected="true">Lernphase</button><button role="tab" data-p="later" aria-selected="false">Nach zwei Wochen</button></div></span>
      <span class="row"><span class="faint">Studio</span><div class="seg" role="tablist" id="ctl-studio"><button role="tab" data-l="stack" aria-selected="false">Gestapelt</button><button role="tab" data-l="rail" aria-selected="true">Seitenleiste</button></div><button class="btn quiet" id="ctl-open-ws">Krisenübung im Studio öffnen</button></span>
      <span class="row"><span class="faint">Warum zuerst</span><div class="seg" role="tablist" id="ctl-why"><button role="tab" data-w="off" aria-selected="false">Aus</button><button role="tab" data-w="line" aria-selected="false">Eine Zeile</button><button role="tab" data-w="order" aria-selected="true">Mit Reihenfolge</button></div></span>
      <span class="row"><span class="faint">Situation</span><select id="ctl-scn"></select></span>
    </div>
  </header>
  <main id="view"></main>
</div>
<script>
${script}
function render() { view.innerHTML = C.studioOne(); }
C.setStudio(true, "rail");
C.setWhy("order");
document.getElementById("ctl-why").addEventListener("click", (e) => {
  const b = e.target.closest("[data-w]"); if (!b) return;
  C.setWhy(b.dataset.w);
  for (const x of document.querySelectorAll("#ctl-why button")) x.setAttribute("aria-selected", String(x === b));
  render();
});
document.getElementById("ctl-studio").addEventListener("click", (e) => {
  const b = e.target.closest("[data-l]"); if (!b) return;
  C.setStudio(true, b.dataset.l);
  for (const x of document.querySelectorAll("#ctl-studio button")) x.setAttribute("aria-selected", String(x === b));
  render();
});
document.getElementById("ctl-open-ws").addEventListener("click", () => { act("stOpen", { dataset: { id: "ws" } }); render(); });
boot("knowledge");
const sel = document.getElementById("ctl-scn");
sel.innerHTML = C.SCENARIO_LIST.map((s) => '<option value="' + s.key + '"' + (s.key === "knowledge" ? " selected" : "") + ">" + s.label + (s.key === "knowledge" ? " (mit Eingang)" : "") + "</option>").join("");
document.getElementById("ctl-phase").addEventListener("click", (e) => {
  const b = e.target.closest("[data-p]"); if (!b) return;
  for (const x of document.querySelectorAll("#ctl-phase button")) x.setAttribute("aria-selected", String(x === b));
  boot(sel.value, b.dataset.p); render();
});
sel.addEventListener("change", () => { boot(sel.value); render(); });
document.getElementById("ctl-slots").addEventListener("click", (e) => {
  const b = e.target.closest("[data-n]"); if (!b) return;
  C.setSlots(Number(b.dataset.n));
  for (const x of document.querySelectorAll("#ctl-slots button")) x.setAttribute("aria-selected", String(x === b));
  render();
});
render();
</script>
</body>
</html>
`;
await Bun.write(`${here}/dist/index.html`, html);
console.log("bytes", html.length);
