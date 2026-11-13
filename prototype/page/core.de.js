const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
/* ---------- shared: how a talked-through conversation lands (F7) ---------- */
function summaryCard(p) {
  const ul = (a) => `<ul>${a.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
  return `<div class="sum">
    <span class="eyebrow">${esc(p.when)} · ${p.turns.length} Wortwechsel</span>
    ${p.before ? `<div class="diff"><span class="faint">Wie du es gesehen hast, vorher und nachher</span><del>${esc(p.before)}</del><ins>${esc(p.after)}</ins></div>` : ""}
    <div class="cols"><div><b>Geklärt</b>${ul(p.settled)}</div><div><b>Noch offen</b>${p.open.length ? ul(p.open) : `<p class="muted">Nichts.</p>`}</div></div>
    <details><summary>Ganzes Gespräch lesen</summary><div class="turns">${p.turns.map(([w, t]) => `<div class="turn ${w === "Du" ? "me" : ""}"><b>${esc(w)}</b><p>${esc(t)}</p></div>`).join("")}</div></details>
  </div>`;
}

const NUM = ["Keine", "Eine", "Zwei", "Drei", "Vier", "Fünf", "Sechs", "Sieben", "Acht", "Neun", "Zehn"];
const num = (n) => NUM[n] || String(n);
let T_NAME = "";
let A_NAME = "Mira";
const KIND = { Question: "Frage", Task: "Aufgabe", Mail: "Mail", "Agent is waiting": "Agent wartet" };
const kindL = (k) => KIND[k] || k;
const V_STOP = new Set(["nicht", "nichts", "einen", "einem", "einer", "eines", "keine", "keinen", "meine", "meinen", "meinem", "meiner", "deine", "deinen", "diese", "dieser", "diesen", "diesem", "dieses", "welche", "welcher", "welches", "sollte", "sollen", "würde", "werden", "wieder", "nochmal", "fragen", "können", "möchte", "machen", "heute", "morgen", "schon", "immer", "etwas", "damit", "dabei", "wegen", "bitte", "zwischen", "ihnen", "ihrem", "ihren", "ihrer", "unter", "gegen", "bevor", "nachher", "vorher"]);
const vWords = (s) => s.toLowerCase().match(/[a-zäöüéèàç]{5,}/g)?.filter((w) => !V_STOP.has(w)) || [];
/* ---------- One Studio: Vera's view with Luca's panel and Nora's replies folded in ---------- */
/* State. loadScenario() at the end of the file fills all three from the chosen scenario pack. */
let U = {}, CAL = {}, U_PROJ = {};
const ust = (id) => (U.st[id] ||= { pick: null, own: "", challenged: false, flagged: {}, openSrc: null, reply: false });
function uPanel(it) {
  const s = ust(it.id), nFlag = Object.keys(s.flagged).length;
  const srcs = it.src ? `<p>${esc(it.read)}</p>
    <div class="row">${it.src.map(([n], i) => `<button class="src${s.flagged[i] ? " flag" : ""}" data-u="src" data-i="${i}" aria-expanded="${s.openSrc === i}">${esc(n)}</button>`).join("")}</div>
    ${s.openSrc !== null ? `<div class="excerpt"><p>${esc(it.src[s.openSrc][1])}</p>${s.flagged[s.openSrc] ? `<span class="pill wait">Von dir markiert</span>` : `<button class="btn" data-u="flag">Das stimmt nicht oder ist veraltet</button>`}</div>` : ""}
    ${nFlag ? `<p class="faint">Markierte Quellen werden weggelassen und im heutigen Protokoll genannt.</p>` : ""}` : "";
  let call;
  if (it.proposal) {
    call = `<div class="ivy"><span class="from">${esc(A_NAME)} schlägt vor, dass du es jetzt so siehst</span><p>${esc(it.proposal)}</p><p class="faint">Bisher: ${esc(it.stand)}</p>
      ${s.reply ? `<label for="u-reply">Was passt nicht?<textarea id="u-reply" placeholder="Sag es in deinen eigenen Worten. ${esc(A_NAME)} nimmt es heute Nacht auf."></textarea></label><div class="row"><button class="btn pri" data-u="send">Senden</button><button class="btn quiet" data-u="cancel">Abbrechen</button></div>`
        : `<div class="row"><button class="btn pri" data-u="yes">Ja, so sehe ich das</button><button class="btn" data-u="notquite">Nicht ganz</button></div>`}</div>`;
  } else if (it.opts) {
    call = `<div class="stack" role="radiogroup" aria-label="Deine Entscheidung"><span class="eyebrow">Deine Entscheidung</span>
        ${it.opts.map((o, i) => `<label class="opt"><input type="radio" name="u-opt" id="u-opt-${it.id}-${i}" value="${i}" ${s.pick === i ? "checked" : ""}><span>${esc(o)}</span></label>`).join("")}
        <label class="opt"><input type="radio" name="u-opt" id="u-opt-${it.id}-x" value="2" ${s.pick === 2 ? "checked" : ""}><span>Etwas anderes</span></label>
        ${s.pick === 2 ? `<input type="text" id="u-own" aria-label="Deine eigene Entscheidung" placeholder="Deine Entscheidung, in einem Satz" value="${esc(s.own)}">` : ""}</div>
      ${s.challenged && s.pick !== null ? `<div class="ivy"><span class="from">Was dagegen spricht</span><p>${esc(s.pick < 2 ? it.counter[s.pick] : "Zu einer Entscheidung, die ich nicht vorgeschlagen habe, habe ich kein Gegenargument.")}</p></div>` : ""}
      ${it.kind === "Question" ? `<details><summary>Später überprüfen (freiwillig)</summary><div class="stack" style="margin-top:8px"><label for="u-expect-${it.id}">Woran merkst du, dass es richtig war?<input type="text" id="u-expect-${it.id}" placeholder="Das Zeichen, das du sehen würdest"></label><label for="u-date-${it.id}">Erinnere mich am<input type="date" id="u-date-${it.id}" value="2027-02-15"></label></div></details>` : ""}
      <div class="row"><button class="btn pri" data-u="decide" ${s.pick === null ? "disabled" : ""}>${it.kind === "Agent is waiting" ? "Entscheiden und dem Agenten sagen" : it.kind === "Mail" ? "Entscheiden und Antwort entwerfen" : "Ich habe entschieden"}</button><button class="btn" data-u="challenge" ${s.pick === null || s.challenged ? "disabled" : ""}>Erst das Gegenargument</button><button class="btn quiet" data-u="talk">Lieber im Gespräch klären</button></div>`;
  } else {
    call = `<div><span class="eyebrow">So siehst du es</span><p>${esc(it.stand)}</p></div><div class="row"><button class="btn pri" data-u="close">Ich habe entschieden</button><button class="btn quiet" data-u="talk">Im Gespräch klären</button></div>`;
  }
  return `<div class="exp" style="padding:14px 16px;border:0;border-radius:8px">${it.prior ? summaryCard(it.prior) : ""}${srcs}${call}</div>`;
}
const hm = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
const dur = (m) => (m >= 60 ? `${Math.floor(m / 60)} Std.${m % 60 ? ` ${m % 60} Min.` : ""}` : `${m} Min.`);
const est = (id) => CAL.est[id] || 20;
function calGaps() {
  return CAL.day.slice(0, -1).map((ev, i) => {
    const end = CAL.day[i + 1].s, start = end <= CAL.now ? ev.e : Math.max(ev.e, CAL.now);
    const ids = Object.keys(U.plan).filter((id) => U.plan[id] === i && U.items.some((x) => x.id === id && x.now));
    return { i, start, end, ids, left: end - start - ids.reduce((n, id) => n + est(id), 0), cur: CAL.now >= ev.e && CAL.now < end, past: end <= CAL.now };
  });
}
function dayRail() {
  const gaps = calGaps();
  const rows = CAL.day.map((ev, i) => {
    const g = gaps[i];
    const nRaise = ev.raise.filter((id) => U.items.some((x) => x.id === id)).length + ev.notes.length;
    const evRow = `<div class="slot ev${ev.e <= CAL.now && U.ev !== ev.id ? " past" : ""}"><span class="tm">${hm(ev.s)}</span><span><button class="evb" data-u="ev" data-to="${ev.id}" aria-expanded="${U.ev === ev.id}"><b>${esc(ev.t)}</b> <span class="faint">bis ${hm(ev.e)}${nRaise && ev.e > CAL.now ? ` · ${nRaise} anzusprechen` : ""}</span></button></span>${U.ev === ev.id ? evDetail(ev) : ""}</div>`;
    if (!g) return evRow;
    const chips = g.ids.map((id) => { const x = U.items.find((y) => y.id === id); return `<div class="chip${U.focus === "all" || x.area === U.focus ? "" : " off"}"><button class="linkq" data-u="jump" data-id="${id}">${esc(x.q)}</button><span class="faint">${dur(est(id))}</span>
      ${gaps[i + 1] ? `<button class="x" data-u="later" data-id="${id}" title="In die nächste freie Zeit verschieben">Später</button>` : ""}<button class="x" data-u="unplan" data-id="${id}" aria-label="Vom Tag nehmen">×</button></div>`; }).join("");
    return evRow + `<div class="slot free${g.cur ? " cur" : ""}${g.past ? " past" : ""}"><span class="tm">${hm(g.start)}</span><div>
      <span class="row">${g.cur ? `<span class="pill think">Jetzt</span>` : ""}<span class="faint">${g.past ? `Vorbei${g.ids.length ? ` · ${g.ids.length} nicht erledigt, mit Später verschieben` : ""}` : `Frei bis ${hm(g.end)} · ${g.left >= 0 ? `noch ${dur(g.left)}` : ""}`}</span>${g.left < 0 && !g.past ? `<span class="pill wait">${dur(-g.left)} zu viel</span>` : ""}</span>${chips}</div></div>`;
  }).join("");
  return `<div class="rail"><span class="eyebrow">${CAL.label}</span>${rows}${railRoutines()}</div>`;
}
function weekGrid() {
  const planned = Object.keys(U.plan).filter((id) => U.items.some((x) => x.id === id && x.now)).length;
  return `<div class="tw"><div class="week">${CAL.week.map((d) => `<div class="wd${d.today ? " today" : ""}"><b>${d.d}${d.today ? " · heute" : ""}</b>
      ${d.ev.map(([t, n]) => `<span><span class="tm">${t}</span> ${esc(n)}</span>`).join("") || `<span class="faint">Nichts eingetragen</span>`}
      ${d.today && planned ? `<span class="faint">${planned} aus deiner Liste eingeplant</span>` : ""}
      ${d.link.filter(([id]) => U.items.some((x) => x.id === id)).map(([id, l]) => `<button class="lk" data-u="jump" data-id="${id}">${esc(l)}</button>`).join("")}</div>`).join("")}</div></div>
    <p class="faint">Die gelben Markierungen sind Fragen aus deiner Liste, die zu diesem Tag gehören. Klick auf eine, um sie zu öffnen.</p>`;
}
/* The Balance outline as the third view: drill in, one level at a time, framed by the ancestors. */
const nItem = (n) => U.items.find((x) => x.id === n.id);
const nKids = (id) => U.nodes.filter((n) => n.parent === id && (!n.item || nItem(n) || U.nodes.some((c) => c.parent === n.id)));
const nOpen = (id) => nKids(id).reduce((sum, n) => sum + (n.item && nItem(n) ? 1 : 0) + nOpen(n.id), 0);
const nTitle = (n) => (n.item && nItem(n) ? nItem(n).q : n.title || "Erledigt");
const nArea = (n) => { let c = n; while (c.parent) c = U.nodes.find((m) => m.id === c.parent); return U.areas.find((a) => a.id === c.area); };
const areaState = (ar) => { const tot = U.areas.reduce((s, a) => s + a.w, 0) || 1, want = Math.round((ar.w / tot) * 100);
  return { want, pill: ar.w === 0 ? `<span class="pill calm">zurückgestellt</span>` : ar.got < want - 10 ? `<span class="pill wait">diese Woche zu kurz gekommen</span>` : ar.got > want + 10 ? `<span class="pill calm">diese Woche viel</span>` : `<span class="pill ok">im Gleichgewicht</span>` }; };
function treeView() {
  const cur = U.nodes.find((n) => n.id === U.at) || null;
  const row = (n) => { const x = n.item && nItem(n), inside = nOpen(n.id), ar = n.area && U.areas.find((a) => a.id === n.area);
    return `<div class="vrow${ar ? "" : " dr"}"${ar ? "" : ` draggable="true" data-node="${esc(n.id)}"`}>${ar ? "" : `<button class="hd" data-u="rowmenu" data-to="${esc(n.id)}" aria-expanded="${U.rowMenu === n.id}" aria-label="${esc(nTitle(n))} verschieben">⋮⋮</button>`}<button class="linkq" data-u="drill" data-to="${esc(n.id)}">${esc(nTitle(n))}</button>
      <span class="faint">${ar ? `${inside} offen` : x ? `${esc(kindL(x.kind))} · ${esc(x.why)}${inside ? ` · ${inside} darin` : ""}` : `${inside} darin`}</span>
      <span class="row">${ar ? areaState(ar).pill : x ? (x.now ? `<span class="pill think">bei Jetzt</span>` : `<button class="btn" data-u="now" data-id="${x.id}">Jetzt</button>`) : ""}<button class="btn quiet" data-u="drill" data-to="${esc(n.id)}" aria-label="${esc(nTitle(n))} öffnen">›</button></span></div>${U.rowMenu === n.id ? rowMenu(n) : ""}`; };
  const kids = nKids(U.at).filter((n) => U.at || U.focus === "all" || n.area === U.focus);
  let inner;
  if (!cur) {
    inner = `<div class="cur"><h2>Alles</h2><p class="muted" style="max-width:62ch">Deine Bereiche. Öffne einen, um zu sehen, was darin liegt. Der Morgenvorschlag nimmt seine Einträge aus dieser Liste und richtet sich nach der Wichtigkeit, die du jedem Bereich gibst.</p>
      <div>${kids.map(row).join("")}</div><p class="faint">Die Bereiche kommen aus deinen Einstellungen. Öffne einen Bereich, um Zeilen hinzuzufügen.</p></div>`;
  } else {
    const x = cur.item && nItem(cur), ar = cur.area && U.areas.find((a) => a.id === cur.area), st = ar && areaState(ar);
    inner = `<div class="cur">
      <div class="row" style="justify-content:space-between"><h2>${esc(nTitle(cur))}</h2>${ar ? st.pill : x ? (x.now ? `<span class="pill think">bei Jetzt</span>` : `<button class="btn" data-u="now" data-id="${x.id}">Jetzt</button>`) : ""}</div>
      ${x ? `<p class="muted">${esc(kindL(x.kind))} · ${esc(x.why)}</p>` : ""}
      ${ar ? `<div class="stack"><div class="balbar"><i style="width:${ar.got}%"></i><b style="left:${st.want}%"></b></div><span class="faint">${ar.got}% deiner Zeit diese Woche. Die Markierung zeigt die ${st.want}%, die du willst.</span></div>` : ""}
      <details${U.treeMore ? " open" : ""}><summary data-u="treeMore">Mehr</summary><div class="ar" style="border:0;padding:8px 0 0">
        <label for="${ar ? "u-w-" + ar.id : "u-n-" + cur.id}">Wichtigkeit<input type="range" id="${ar ? "u-w-" + ar.id : "u-n-" + cur.id}" min="0" max="100" step="5" value="${ar ? ar.w : cur.w}"><span class="code">${ar ? ar.w : cur.w}</span></label>
        <span class="faint">${ar ? "Im Verhältnis zu deinen anderen Bereichen. Null stellt den Bereich zurück." : "Im Verhältnis zu den Zeilen daneben. Null stellt sie zurück."}</span>
        ${ar ? "" : `<div class="row">${x ? (x.who === "agent" ? `<span class="pill think">ein Agent arbeitet daran</span>` : `<button class="btn" data-u="hand" data-id="${x.id}">An einen Agenten abgeben</button>`) : ""}<button class="btn" data-u="noop">Fokus diesen Monat</button><button class="btn" data-u="noop">Zeilen nacheinander</button><button class="btn" data-u="noop">Verschieben</button></div>`}</div></details>
      <div>${kids.map(row).join("") || `<p class="muted">Noch nichts darin.${x ? " Sobald du eine Zeile hinzufügst, wird daraus ein Projekt." : ""}</p>`}</div>
      <div class="row" style="flex-wrap:nowrap"><input type="text" id="u-add" aria-label="Eine neue Zeile in ${esc(nTitle(cur))}" placeholder="Zeile zu ${esc(nTitle(cur))} hinzufügen"><button class="btn" data-u="addrow" style="white-space:nowrap">Hinzufügen</button></div></div>`;
  }
  const path = []; for (let c = cur && cur.parent; c; c = (U.nodes.find((n) => n.id === c) || {}).parent) path.unshift(U.nodes.find((n) => n.id === c));
  if (cur) path.unshift(null);
  return path.reduceRight((html, n) => `<div class="anc"><button class="anch" data-u="drill" data-to="${n ? esc(n.id) : ""}"${n ? ` data-drop="${esc(n.id)}"` : ""}>‹ ${n ? esc(nTitle(n)) : "Alles"}</button>${html}</div>`, inner);
}
document.addEventListener("change", (e) => {
  const a = /^u-w-(.+)$/.exec(e.target.id || ""), n = /^u-n-(.+)$/.exec(e.target.id || "");
  if (a) { U.areas.find((x) => x.id === a[1]).w = Number(e.target.value); U.treeMore = true; render(); }
  else if (n) { U.nodes.find((x) => x.id === n[1]).w = Number(e.target.value); U.treeMore = true; render(); }
});

/* Reordering in the drill-in: a handle menu that works everywhere, and drag where the browser supports it. */
const nFind = (id) => U.nodes.find((n) => n.id === id);
const nAfter = (n) => { const s = nKids(n.parent), i = s.indexOf(n); return s[i + 1] ? s[i + 1].id : null; };
function nMove(id, parent, before) {
  const n = nFind(id); if (!n || n.area || !parent) return false;
  for (let c = parent; c; c = (nFind(c) || {}).parent) if (c === id) return false;
  U.nodes.splice(U.nodes.indexOf(n), 1); n.parent = parent;
  const i = before ? U.nodes.findIndex((x) => x.id === before) : -1;
  if (i >= 0) U.nodes.splice(i, 0, n); else U.nodes.push(n);
  const fix = (m) => { const x = nItem(m); if (x) x.area = nArea(m).id; U.nodes.filter((c) => c.parent === m.id).forEach(fix); };
  fix(n); return true;
}
function nShift(id, dir) {
  const n = nFind(id), s = nKids(n.parent), i = s.indexOf(n), p = nFind(n.parent);
  if (dir === "up" && i > 0) return nMove(id, n.parent, s[i - 1].id);
  if (dir === "down" && i < s.length - 1) return nMove(id, n.parent, s[i + 2] ? s[i + 2].id : null);
  if (dir === "out" && p && p.parent) return nMove(id, p.parent, nAfter(p));
  if (dir === "into" && i > 0) return nMove(id, s[i - 1].id, null);
  return false;
}
function rowMenu(n) {
  const s = nKids(n.parent), i = s.indexOf(n), p = nFind(n.parent);
  return `<div class="exp" style="padding-left:14px"><div class="row">
      <button class="btn" data-u="mv" data-to="up" ${i > 0 ? "" : "disabled"}>Hoch</button><button class="btn" data-u="mv" data-to="down" ${i < s.length - 1 ? "" : "disabled"}>Runter</button>
      <button class="btn" data-u="mv" data-to="out" ${p && p.parent ? "" : "disabled"}>Raus, neben ${esc(p ? nTitle(p) : "")}</button>
      <button class="btn" data-u="mv" data-to="into" ${i > 0 ? "" : "disabled"}>${i > 0 ? `In ${esc(nTitle(s[i - 1]))} hinein` : "In die Zeile darüber hinein"}</button></div>
    <span class="faint">Du kannst die Zeile auch ziehen. Zwischen zwei Zeilen ordnest du sie um, auf einer Zeile legst du sie hinein, und auf einer Rahmenbeschriftung oben schiebst du sie auf diese Ebene hinaus.</span></div>`;
}
let dragId = null;
const clearZones = () => document.querySelectorAll("[data-zone]").forEach((el) => el.removeAttribute("data-zone"));
const dropTarget = (e) => { const t = e.target.closest && e.target.closest("[data-node],[data-drop]"); return t && t.dataset.node !== dragId ? t : null; };
const dropZone = (t, e) => { if (t.dataset.drop) return "into"; const r = t.getBoundingClientRect(), y = (e.clientY - r.top) / r.height; return y < 0.3 ? "before" : y > 0.7 ? "after" : "into"; };
document.addEventListener("dragstart", (e) => { const r = e.target.closest && e.target.closest("[data-node]"); if (!r) return; dragId = r.dataset.node; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", dragId); });
document.addEventListener("dragover", (e) => { if (!dragId) return; clearZones(); const t = dropTarget(e); if (!t) return; e.preventDefault(); t.dataset.zone = dropZone(t, e); });
document.addEventListener("drop", (e) => {
  if (!dragId) return; const t = dropTarget(e); if (!t) return; e.preventDefault();
  const zone = dropZone(t, e), tn = t.dataset.node && nFind(t.dataset.node);
  const ok = t.dataset.drop ? nMove(dragId, t.dataset.drop, null) : zone === "before" ? nMove(dragId, tn.parent, tn.id) : zone === "after" ? nMove(dragId, tn.parent, nAfter(tn)) : nMove(dragId, tn.id, null);
  U.toast = ok ? "Verschoben." : "Diese Zeile kann dort nicht hin."; dragId = null; render();
});
document.addEventListener("dragend", () => { dragId = null; clearZones(); });

/* Day greeting: one sentence, then what changed since yesterday as links. */
function greetStrip() {
  const has = (id) => U.items.some((x) => x.id === id && x.now);
  const n = U.dfy.groups.filter((g) => !g.undone).reduce((s, g) => s + g.n, 0);
  const chips = [
    has("rate") ? `<button class="gchip" data-u="jump" data-id="rate">${esc(A_NAME)} hat einen Vorschlag für dich</button>` : "",
    has("inv") ? `<button class="gchip" data-u="jump" data-id="inv">Ein Agent wartet auf eine Entscheidung</button>` : "",
    n ? `<button class="gchip" data-u="dfy">${n === 1 ? "1 Sache wurde" : `${n} Dinge wurden`} für dich erledigt</button>` : "",
    U.rev.closed ? "" : `<button class="gchip" data-u="view" data-id="review">Der Rückblick auf letzte Woche ist offen · etwa 5 Minuten</button>`,
  ].filter(Boolean);
  return chips.length ? `<div class="row" aria-label="Seit gestern">${chips.join("")}</div>` : "";
}

/* Done for you: one line at rest, grouped by what the assistant did and why, with undo per group. */
function doneForYou() {
  const live = U.dfy.groups.filter((g) => !g.undone), n = live.reduce((s, g) => s + g.n, 0);
  return `<div><div class="row" style="justify-content:space-between"><span><span class="eyebrow">Heute für dich erledigt · ${n}</span> <span class="faint">${live.map((g) => `${g.label} ${g.n}`).join(", ")}</span></span>
      <button class="btn quiet" data-u="dfy" aria-expanded="${U.dfy.open}">${U.dfy.open ? "Ausblenden" : "Anzeigen"}</button></div>
    ${U.dfy.open ? U.dfy.groups.map((g) => `<div class="vrow"><span class="linkq">${g.label} · ${g.n}</span><span class="faint">${g.undone ? "Rückgängig gemacht. Alles ist wieder, wie es war." : g.stopped ? esc(A_NAME) + " fragt dich ab jetzt zuerst." : esc(g.why)}</span>
        <span class="row"><button class="btn quiet" data-u="dfyShow" data-to="${g.id}" aria-expanded="${U.dfy.show === g.id}">${U.dfy.show === g.id ? "Weniger" : "Details"}</button>${g.undone ? "" : `<button class="btn" data-u="dfyUndo" data-to="${g.id}">Rückgängig</button>`}${g.stopped || g.undone ? "" : `<button class="btn quiet" data-u="dfyStop" data-to="${g.id}">Erst fragen</button>`}</span></div>
      ${U.dfy.show === g.id ? `<ul class="plain" style="margin-bottom:8px">${g.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : ""}`).join("") : ""}</div>`;
}

/* Weekly review: four things to look at, each with one decision. */
function reviewView() {
  const R = U.rev, tot = U.areas.reduce((s, a) => s + a.w, 0) || 1;
  const off = U.areas.filter((a) => Math.abs(a.got - Math.round((a.w / tot) * 100)) > 10 || R.area[a.id]);
  const done = [R.seen, off.every((a) => R.area[a.id]), R.stale.every((s) => s.a), R.checks.every((c) => c.a)];
  const n = done.filter(Boolean).length, mark = (i) => (done[i] ? `<span class="pill ok">angesehen</span>` : `<span class="pill calm">offen</span>`);
  const head = (i, t) => `<div class="row" style="justify-content:space-between"><h3>${t}</h3>${mark(i)}</div>`;
  return `<div class="row" style="justify-content:space-between"><h2>Rückblick auf letzte Woche</h2><span class="row"><span class="faint">${n} von 4 angesehen</span><button class="btn quiet" data-u="view" data-id="day">Zurück zum Tag</button></span></div>
    <div class="ar">${head(0, `Was du abgeschlossen hast · ${R.wins.total}`)}<p class="muted">${R.wins.by}</p><ul class="plain">${R.wins.top.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>
      ${R.seen ? "" : `<div class="row"><button class="btn" data-u="revSeen">Gesehen</button></div>`}</div>
    <div class="ar">${head(1, "Wohin deine Zeit ging")}
      ${U.areas.map((a) => { const want = Math.round((a.w / tot) * 100), isOff = off.includes(a), c = R.area[a.id];
        return `<div class="stack"><span class="row" style="justify-content:space-between"><b>${a.label}</b><span class="faint">${a.got}% deiner Zeit, du willst ${want}%</span></span><div class="balbar"><i style="width:${a.got}%"></i><b style="left:${want}%"></b></div>
          ${!isOff ? "" : c ? `<span class="faint">${c === "room" ? `Der Vorschlag für nächste Woche beginnt mit ${a.label}.` : c === "fine" ? "Bleibt, wie es ist." : `Du willst jetzt weniger für ${a.label}.`}</span>`
            : a.got < want ? `<div class="row"><button class="btn" data-u="revArea" data-id="${a.id}" data-to="room">Nächste Woche Platz schaffen</button><button class="btn" data-u="revArea" data-id="${a.id}" data-to="lower">Ich will vorerst weniger davon</button><button class="btn quiet" data-u="revArea" data-id="${a.id}" data-to="fine">Das war eine Ausnahme</button></div>`
            : `<div class="row"><button class="btn" data-u="revArea" data-id="${a.id}" data-to="fine">Das war richtig für diese Woche</button><button class="btn quiet" data-u="revArea" data-id="${a.id}" data-to="room">Nächste Woche zurückhalten</button></div>`}</div>`; }).join("")}</div>
    <div class="ar">${head(2, "Was liegen blieb")}
      ${R.stale.map((s) => `<div class="vrow"><span class="linkq">${esc(s.q)}</span><span class="faint">${s.a ? esc(s.a) : s.age}</span><span class="row">${s.a ? "" : `<button class="btn" data-u="revStale" data-id="${s.id}" data-to="Behalten.">Behalten</button><button class="btn" data-u="revStale" data-id="${s.id}" data-to="Geparkt.">Parken</button><button class="btn quiet" data-u="revStale" data-id="${s.id}" data-to="Losgelassen.">Loslassen</button>`}</span></div>`).join("")}</div>
    <div class="ar">${head(3, "Entscheidungen zum Überprüfen")}
      ${R.checks.map((c) => `<div class="stack"><span><b>${esc(c.q)}</b> <span class="faint">${c.on}</span></span><span class="muted">Du hast erwartet: ${esc(c.expect)}</span>
        ${c.a ? `<span class="pill ok" style="align-self:flex-start">${esc(c.a)}</span>` : `<div class="row"><button class="btn" data-u="revCheck" data-id="${c.id}" data-to="Ist eingetreten">Ist eingetreten</button><button class="btn" data-u="revCheck" data-id="${c.id}" data-to="Ist nicht eingetreten">Ist nicht eingetreten</button><button class="btn quiet" data-u="revCheck" data-id="${c.id}" data-to="Zu früh, in einem Monat nochmal fragen">Zu früh</button></div>`}</div>`).join("")}</div>
    ${n === 4 ? `<div class="ivy"><span class="from">Der Rückblick ist fertig</span><p>Der Vorschlag vom Montag richtet sich nach dem, was du hier gewählt hast.</p><div class="row"><button class="btn pri" data-u="revClose">Rückblick abschliessen</button></div></div>` : ""}`;
}

/* The Now page as a stream: what is new comes up at the top as a card and leaves once it is dealt with. */
function dfyCard() {
  const live = U.dfy.groups.filter((g) => !g.undone), n = live.reduce((s, g) => s + g.n, 0);
  return `<div class="card"><span class="row" style="justify-content:space-between"><span class="eyebrow">Für dich erledigt</span><span class="pill think">neu</span></span>
    <span class="q">${n === 1 ? "1 Sache wurde" : `${n} Dinge wurden`} seit gestern für dich erledigt</span>
    <div>${U.dfy.groups.map((g) => `<div class="vrow"><span class="linkq">${g.label} · ${g.n}</span><span class="faint">${g.undone ? "Rückgängig gemacht. Alles ist wieder, wie es war." : g.stopped ? esc(A_NAME) + " fragt dich ab jetzt zuerst." : esc(g.why)}</span>
        <span class="row"><button class="btn quiet" data-u="dfyShow" data-to="${g.id}" aria-expanded="${U.dfy.show === g.id}">${U.dfy.show === g.id ? "Weniger" : "Details"}</button>${g.undone ? "" : `<button class="btn" data-u="dfyUndo" data-to="${g.id}">Rückgängig</button>`}${g.stopped || g.undone ? "" : `<button class="btn quiet" data-u="dfyStop" data-to="${g.id}">Erst fragen</button>`}</span></div>
      ${U.dfy.show === g.id ? `<ul class="plain" style="margin-bottom:8px">${g.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : ""}`).join("")}</div>
    <div class="row"><button class="btn pri" data-u="dfyDismiss">Passt so</button></div></div>`;
}
function reviewCard() {
  return `<div class="card"><span class="row" style="justify-content:space-between"><span class="eyebrow">Wochenrückblick</span><span class="pill think">neu</span></span>
    <span class="q">Der Rückblick auf letzte Woche ist offen</span><span class="sub">Vier Dinge zum Ansehen, das dauert etwa fünf Minuten.</span>
    <div class="row"><button class="btn pri" data-u="view" data-id="review">Rückblick starten</button><button class="btn quiet" data-u="revLater">Heute nicht</button></div></div>`;
}

/* Meetings as first-class entries: who, where, what to raise, and one question when they end. */
const evFind = (id) => CAL.day.find((e) => e.id === id);
const areaLabel = (id) => (U.areas.find((a) => a.id === id) || {}).label || id;
function evDetail(ev) {
  const linked = ev.raise.map((id) => U.items.find((x) => x.id === id)).filter(Boolean);
  return `<div class="evd"><span class="faint">${esc(ev.with)} · ${esc(ev.where)}</span>
    <span class="row"><span class="pill calm">${areaLabel(ev.area)}</span><span class="faint">${dur(ev.e - ev.s)}, zählt zu ${areaLabel(ev.area)}</span>${ev.join && ev.e > CAL.now ? `<button class="btn" data-u="noop">Beitreten</button>` : ""}</span>
    ${ev.brief && ev.e > CAL.now ? (U.briefOpen[ev.id] ? briefBlock(ev) : `<button class="btn" data-u="brief" data-to="${ev.id}">Bereite mich vor</button>`) : ""}${lastBlock(ev)}
    <span class="eyebrow">${ev.e <= CAL.now ? "Was du angesprochen hast" : "Ansprechen"}</span>
    ${linked.map((x) => `<button class="lk" data-u="jump" data-id="${x.id}">${esc(x.q)}</button>`).join("")}${ev.notes.map((n) => `<span>${esc(n)}</span>`).join("")}${linked.length + ev.notes.length ? "" : `<span class="faint">Noch nichts.</span>`}
    ${ev.e > CAL.now ? `<span class="row" style="flex-wrap:nowrap"><input type="text" id="u-raise" aria-label="Etwas zum Ansprechen bei ${esc(ev.t)}" placeholder="Etwas zum Ansprechen"><button class="btn" data-u="raise">Hinzufügen</button></span>
      <span class="faint">Zehn Minuten vorher erscheint das zuoberst in deiner Liste.</span>` : ""}</div>`;
}
function afterCard() {
  const ev = evFind(U.after);
  return `<div class="card"><span class="row" style="justify-content:space-between"><span class="eyebrow">Termin vorbei</span><span class="pill think">neu</span></span>
    <span class="q">${esc(ev.t)} war um ${hm(ev.e)} vorbei</span><span class="sub">${esc(ev.with)}. Gibt es etwas festzuhalten?</span>
    <div class="row" style="flex-wrap:nowrap"><input type="text" id="u-after" aria-label="Etwas festhalten aus ${esc(ev.t)}" placeholder="Eine Aufgabe, ein Gedanke, eine Entscheidung"><button class="btn pri" data-u="afterKeep" style="white-space:nowrap">Festhalten</button></div>
    <div class="row"><button class="btn quiet" data-u="afterNone">Nichts festzuhalten</button><span class="faint">Eine Aufgabe bleibt in Threva. Die Notiz geht über den Notiz-Adapter in deinen Notizordner.</span></div></div>`;
}

/* Meetings, second pass: a card before the meeting, what you kept last time, and the assistant's brief with the adapter each fact came from. */
const evSoon = () => CAL.day.find((ev) => ev.s > CAL.now && ev.s - CAL.now <= 10 && !U.soonDone[ev.id]) || null;
function lastBlock(ev) {
  const kept = ev.kept && ev.kept.length ? `<span class="eyebrow">Heute festgehalten</span><ul class="plain">${ev.kept.map((k) => `<li>${esc(k)}</li>`).join("")}</ul>` : "";
  return `${kept}${ev.last ? `<span class="eyebrow">Letztes Mal · ${esc(ev.last.when)}</span><ul class="plain">${ev.last.kept.map((k) => `<li>${esc(k)}</li>`).join("")}</ul><span class="faint">aus deinem ${esc(ev.last.from)}</span>` : ""}`;
}
function briefBlock(ev) {
  const b = ev.brief, open = U.evSrc && U.evSrc.startsWith(ev.id + ":") ? Number(U.evSrc.split(":")[1]) : null;
  return `<div class="ivy" style="align-self:stretch"><span class="from">Vorbereitung von ${esc(A_NAME)} · vorbereitet um ${b.at}</span><p>${esc(b.text)}</p>
    <div class="row">${b.src.map(([k, ad], i) => `<button class="src" data-u="evsrc" data-to="${ev.id}:${i}" aria-expanded="${open === i}">${k} · ${esc(ad)}</button>`).join("")}</div>
    ${open !== null ? `<div class="excerpt"><p>${esc(b.src[open][2])}</p></div>` : `<span class="faint">Bei jeder Angabe steht der Adapter, aus dem sie stammt. Klick auf einen, um zu sehen, was ${esc(A_NAME)} gelesen hat.</span>`}
    ${b.missing.map((m) => `<span class="row"><span class="pill wait">nicht gelesen</span><span class="faint">${esc(m)}</span></span>`).join("")}</div>`;
}
function raiseList(ev) {
  const linked = ev.raise.map((id) => U.items.find((x) => x.id === id)).filter(Boolean);
  return linked.length + ev.notes.length ? `<span class="eyebrow">Ansprechen</span><div class="stack" style="align-items:flex-start">${linked.map((x) => `<button class="lk" data-u="jump" data-id="${x.id}">${esc(x.q)}</button>`).join("")}${ev.notes.map((n) => `<span>${esc(n)}</span>`).join("")}</div>` : "";
}
function soonCard(ev) {
  return `<div class="card evd" style="padding:14px 16px"><span class="row" style="justify-content:space-between;align-self:stretch"><span class="eyebrow">In ${ev.s - CAL.now} ${ev.s - CAL.now === 1 ? "Minute" : "Minuten"}</span><span class="pill think">neu</span></span>
    <span class="q">${esc(ev.t)}</span><span class="sub">${esc(ev.with)} · ${esc(ev.where)} · bis ${hm(ev.e)}</span>
    ${ev.brief ? briefBlock(ev) : ""}${lastBlock(ev)}${raiseList(ev)}
    <div class="row">${ev.join ? `<button class="btn pri" data-u="noop">Beitreten</button>` : ""}<button class="btn${ev.join ? "" : " pri"}" data-u="soonDone" data-to="${ev.id}">Verstanden</button></div></div>`;
}

/* Ranger, routines and flows as one idea: who does a row. You, an agent once, or a routine on a schedule. The flow is its steps. */
const rtFind = (id) => U.rt.find((r) => r.id === id);
function routineCards() {
  return U.rt.flatMap((r) => [
    r.pending ? `<div class="card"><span class="row" style="justify-content:space-between"><span class="eyebrow">Routine wartet</span><span class="pill think">neu</span></span>
      <span class="q">${esc(r.name)}</span><span class="sub">${esc(r.pending)}</span>
      <div class="row"><button class="btn pri" data-u="rtOk" data-to="${r.id}">Mach das</button><button class="btn" data-u="rtSkip" data-to="${r.id}">Diesmal nicht</button><button class="btn quiet" data-u="rtAuto" data-to="${r.id}">Mach das, und frag nicht mehr</button></div></div>` : "",
    r.failed && !r.ack ? `<div class="card"><span class="row" style="justify-content:space-between"><span class="eyebrow">Routine fehlgeschlagen</span><span class="pill think">neu</span></span>
      <span class="q">${esc(r.name)}</span><span class="sub">${esc(r.failed)}</span>
      <div class="row"><button class="btn pri" data-u="rtRetry" data-to="${r.id}">Nochmal ausführen</button><button class="btn" data-u="rtOpen" data-to="${r.id}">Routine öffnen</button><button class="btn quiet" data-u="rtAck" data-to="${r.id}">Weglegen</button></div></div>` : "",
  ]).filter(Boolean);
}
function rtDraftCard() {
  const m = /(?:^|[^a-zäöü])(jede[ns]?\s+[a-zäöü]+(?:\s+(?:morgen|abend|nachmittag))?(?:\s+um\s+\d[\d:.]*)?|täglich|wöchentlich|monatlich)(?![a-zäöü])/i.exec(U.rtDraft);
  return `<div class="ivy"><span class="from">Das klingt nach etwas, das sich wiederholt</span><p>«${esc(U.rtDraft)}»</p>
    <span class="faint">Wann: ${m ? esc(m[1]) : "wählst du"} · ${esc(A_NAME)} zeigt dir die Schritte vor dem ersten Lauf · ${esc(A_NAME)} fragt dich vor jedem Lauf, bis du es anders sagst</span>
    <div class="row"><button class="btn pri" data-u="rtMake">Als Routine einrichten</button><button class="btn" data-u="rtKeep">Als Gedanken festhalten</button></div></div>`;
}
function rtDetail(r) {
  return `<div class="exp" style="padding-left:14px">
    <span class="eyebrow">Schritte${r.recipe ? ` · Rezept: ${esc(r.recipe)}` : ""}</span>
    <ol class="plain">${r.steps.map(([s, from]) => `<li>${esc(s)} <span class="src">${esc(from)}</span></li>`).join("")}</ol>
    <span class="eyebrow">Letzte Läufe</span><ul class="plain">${r.runs.map(([w, res]) => `<li><b>${esc(w)}</b> ${esc(res)}</li>`).join("") || "<li>Noch nie gelaufen.</li>"}</ul>
    <div class="row"><div class="seg" role="tablist" aria-label="Vor jedem Lauf"><button role="tab" aria-selected="${r.policy === "ask"}" data-u="rtPolicy" data-to="${r.id}" data-id="ask">Erst fragen</button><button role="tab" aria-selected="${r.policy === "auto"}" data-u="rtPolicy" data-to="${r.id}" data-id="auto">Selbständig erledigen</button></div>
      <button class="btn" data-u="rtPause" data-to="${r.id}">${r.paused ? "Fortsetzen" : "Pausieren"}</button><button class="btn" data-u="rtRetry" data-to="${r.id}">Jetzt ausführen</button></div>
    <div class="row" style="flex-wrap:nowrap"><input type="text" id="u-rt-ask" aria-label="${esc(A_NAME)} bitten, ${esc(r.name)} zu ändern" placeholder="${esc(A_NAME)} bitten, diese Routine zu ändern"><button class="btn" data-u="rtAsk" style="white-space:nowrap">Vorschlagen</button></div>
    <span class="faint">${esc(r.when)} · nächster Lauf ${esc(r.next)}. Eine Änderung siehst du als Vorher und Nachher, und nichts ändert sich, bevor du bestätigst.</span></div>`;
}
function handedView() {
  const working = U.items.filter((x) => x.who === "agent" || x.kind === "Agent is waiting");
  const state = (r) => `${r.paused ? `<span class="pill calm">pausiert</span>` : ""}${r.pending ? `<span class="pill wait">wartet auf dich</span>` : ""}${r.failed && !r.fixed ? `<span class="pill wait">fehlgeschlagen</span>` : ""}<span class="pill calm">${r.policy === "ask" ? "fragt erst" : "selbständig"}</span>`;
  return `<p class="muted" style="max-width:66ch">Hier steht alles, was du nicht selbst machst. Ein Agent arbeitet einmal an einer Zeile, eine Routine erledigt etwas nach Plan. Ein Rezept ist die Liste der Schritte, der beide folgen.</p>
    <div class="ar"><h3>Agenten bei der Arbeit · ${working.length}</h3>
      ${working.map((x) => `<div class="vrow"><button class="linkq" data-u="jump" data-id="${x.id}">${esc(x.q)}</button><span class="faint">${esc(x.doing || x.next || "")}</span><span>${x.kind === "Agent is waiting" ? `<span class="pill wait">wartet auf dich</span>` : `<span class="pill think">arbeitet</span>`}</span></div>`).join("") || `<p class="muted">Kein Agent ist bei der Arbeit. Öffne eine Zeile unter Alles und wähle An einen Agenten abgeben.</p>`}</div>
    <div class="ar"><h3>Routinen · ${U.rt.length}</h3>
      ${U.rt.map((r) => `<div class="vrow"><button class="linkq" data-u="rtOpen" data-to="${r.id}" aria-expanded="${U.rtOpen === r.id}">${esc(r.name)}</button><span class="faint">${esc(r.when)}${r.background ? " · im Hintergrund" : ""} · ${esc((r.runs[0] || ["", "noch nie gelaufen"])[1].split(". ")[0])}</span><span class="row">${state(r)}</span></div>${U.rtOpen === r.id ? rtDetail(r) : ""}`).join("")}
      <span class="faint">Für eine neue Routine tipp sie oben ins Feld, zum Beispiel: ${esc(PACK.examples.routine)}.</span></div>
    <div class="ar"><h3>Rezepte · ${U.recipes.length}</h3>
      ${U.recipes.map(([n, steps, by]) => `<div class="vrow"><span class="linkq">${esc(n)}</span><span class="faint">${steps} Schritte · verwendet von ${esc(by)}</span><span><button class="btn quiet" data-u="noop">Für eine Zeile verwenden</button></span></div>`).join("")}</div>`;
}
function railRoutines() {
  const today = U.rt.filter((r) => !r.background && !r.paused);
  return `<div class="slot" style="grid-template-columns:minmax(0,1fr)"><span class="faint">Routinen heute: ${today.length} nach Plan, ${U.rt.length - today.length} im Hintergrund.</span><button class="btn quiet" data-u="view" data-id="handed" style="justify-self:start;padding-left:0">Abgegebenes ansehen</button></div>`;
}

function studio() {
  const inF = (x) => U.focus === "all" || x.area === U.focus, focusArea = U.areas.find((a) => a.id === U.focus);
  const now = U.items.filter((x) => x.now && inF(x)), rest = U.items.filter((x) => !x.now && inF(x));
  const gaps = calGaps(), cur = gaps.find((g) => g.cur), next = CAL.day.find((ev) => ev.s > CAL.now);
  const card = (x) => { const g = gaps[U.plan[x.id]]; return `<div class="card" id="card-${x.id}"><span class="row" style="justify-content:space-between"><span class="eyebrow">${esc(kindL(x.kind))}</span><span class="row">${x.proposal ? `<span class="pill wait">${esc(A_NAME)} wartet auf dich</span>` : ""}${x.fresh ? `<span class="pill think">neu</span><button class="btn quiet" data-u="seen" data-id="${x.id}">Gesehen, bleibt bei Jetzt</button>` : ""}</span></span>
      <button class="linkq" data-u="open" data-id="${x.id}" aria-expanded="${U.open === x.id}">${esc(x.q)}</button>
      <span class="sub">${esc(x.next || x.why)}</span>
      ${U.open === x.id ? uPanel(x) : `<div class="row">${x.kind === "Task" ? `<button class="btn" data-u="tick" data-id="${x.id}">Erledigt</button>` : `<button class="btn" data-u="open" data-id="${x.id}">${x.proposal ? "Vorschlag ansehen" : "Durchdenken"}</button>`}
        ${g ? `<span class="faint">Eingeplant um ${hm(g.start)} · ${dur(est(x.id))}</span>` : `<button class="btn" data-u="plan" data-id="${x.id}">Heute einplanen</button>`}<button class="btn quiet" data-u="now" data-id="${x.id}">Für heute genug</button></div>`}</div>`; };
  const line = (x) => `<div class="vrow"><span class="linkq">${esc(x.q)}</span><span class="faint">${x.suggest ? esc(A_NAME) + " würde das jetzt hervorholen. " : ""}${esc(x.why)}</span>
      <span class="row"><button class="btn quiet" data-u="more" data-id="${x.id}" aria-expanded="${U.more === x.id}">${U.more === x.id ? "Weniger" : "Mehr"}</button><button class="btn" data-u="now" data-id="${x.id}">Jetzt</button></span></div>
    ${U.more === x.id ? `<div class="exp" style="padding-left:14px"><div class="row"><span class="pill calm">${areaLabel(x.area)}</span><span class="pill calm">${x.model === "cloud" ? "Cloud" : x.model}</span>${x.tonight ? `<span class="pill think">heute Nacht</span>` : ""}</div>
      <div class="row"><button class="btn" data-u="tonight" data-id="${x.id}">${x.tonight ? "Heute Nacht nicht darüber nachdenken" : "Heute Nacht darüber nachdenken"}</button><button class="btn" data-u="noop">In Bereich verschieben</button><button class="btn" data-u="noop">Parken</button></div></div>` : ""}`;
  const mq = U.merge && U.items.find((x) => x.id === U.merge.id);
  const fresh = now.filter((x) => x.fresh), steady = now.filter((x) => !x.fresh);
  const news = [evSoon() ? soonCard(evSoon()) : "", U.after && (U.focus === "all" || U.focus === evFind(U.after).area) ? afterCard() : "", ...fresh.filter((x) => x.kind === "Agent is waiting").map(card), ...fresh.filter((x) => x.kind !== "Agent is waiting").map(card), ...(U.focus === "all" ? routineCards() : []), U.dfy.card && U.focus === "all" ? dfyCard() : "", U.rev.card && !U.rev.closed && U.focus === "all" ? reviewCard() : ""].filter(Boolean);
  const lists = `${news.length ? `<div class="stack"><span class="eyebrow">Neu seit gestern · ${news.length}</span>${(U.newAll ? news : news.slice(0, 4)).join("")}${news.length > 4 ? `<button class="btn" data-u="newAll" style="align-self:flex-start">${U.newAll ? "Weniger zeigen" : `${news.length - 4} weitere zeigen`}</button>` : ""}</div>` : ""}<div class="stack"><span class="eyebrow">Jetzt · Fragen, Aufgaben, Mail und Agenten in einer Liste</span>${steady.map(card).join("") || `<p class="muted">Nichts braucht dich. Drück bei etwas weiter unten auf Jetzt.</p>`}</div>
    <div class="stack"><span class="eyebrow">Ausserdem im Kopf</span>${rest.map(line).join("") || `<p class="muted">Nichts.</p>`}</div>`;
  const body = `
    ${U.toast ? `<div class="toast" role="status">${esc(U.toast)}</div>` : ""}
    <p class="big">${CAL.now < 720 ? "Guten Morgen" : "Guten Nachmittag"}${T_NAME ? `, ${esc(T_NAME)}` : ""}. ${now.length === 0 ? "Nichts braucht" : now.length === 1 ? "Eine Sache braucht" : `${num(now.length)} Dinge brauchen`} dich jetzt${focusArea ? ` im Bereich ${focusArea.label}` : ""}. ${cur ? `Du bist bis ${hm(cur.end)} frei.` : next ? `Als Nächstes: ${esc(next.t)} um ${hm(next.s)}.` : ""}</p>

    <div class="row" style="flex-wrap:nowrap"><input type="text" id="u-new" aria-label="Ein neuer Gedanke" placeholder="Was ist dir eingefallen? Zum Beispiel: ${esc(PACK.examples.merge)}"><button class="btn pri" data-u="add" style="white-space:nowrap">Festhalten</button></div>
    ${U.rtDraft ? rtDraftCard() : ""}
    ${mq ? `<div class="ivy"><span class="from">${esc(A_NAME)} meint, das gehört zu etwas, das du schon hast</span><p>«${esc(U.merge.text)}» klingt nach einem Teil von <b>${esc(mq.q)}</b></p><div class="row"><button class="btn pri" data-u="mergeYes">Dort hinzufügen</button><button class="btn" data-u="mergeNo">Getrennt festhalten</button></div></div>` : ""}
    <div class="row" style="justify-content:space-between"><div class="seg" role="tablist" aria-label="Kalenderansicht"><button role="tab" aria-selected="${U.view === "day"}" data-u="view" data-id="day">Tag</button><button role="tab" aria-selected="${U.view === "week"}" data-u="view" data-id="week">Woche</button><button role="tab" aria-selected="${U.view === "all"}" data-u="view" data-id="all">Alles</button><button role="tab" aria-selected="${U.view === "handed"}" data-u="view" data-id="handed">Abgegeben</button></div>
      <span class="row"><span class="faint">Fokus</span><div class="seg" role="tablist" aria-label="Fokus">${[{ id: "all", label: "Alle" }, ...U.areas].map((a) => `<button role="tab" aria-selected="${U.focus === a.id}" data-u="focus" data-id="${a.id}">${a.label}</button>`).join("")}</div></span></div>
    ${U.view === "handed" ? handedView() : U.view === "review" ? reviewView() : U.view === "all" ? treeView() : U.view === "week" ? weekGrid() + lists : `<div class="daygrid"><div style="display:flex;flex-direction:column;gap:16px;min-width:0">${lists}</div>${dayRail()}</div>`}

    <div><span class="eyebrow">Heute entschieden · ${U.log.length}</span>
      <pre class="note">${U.log.length ? esc(U.log.map((h) => "- " + h).join("\n")) : "Noch nichts. Jede Entscheidung, die du triffst, landet hier."}</pre>
      <div class="row" style="margin-top:8px"><button class="btn" data-u="copy" ${U.log.length ? "" : "disabled"}>${U.copied ? "Kopiert" : "Als Übergabe kopieren"}</button>
        <button class="btn quiet" data-u="noop">Geparkt · 1</button><button class="btn quiet" data-u="view" data-id="review">Wochenrückblick</button><button class="btn quiet" data-u="dfyBack">Für dich erledigt · ${U.dfy.groups.filter((g) => !g.undone).reduce((s, g) => s + g.n, 0)}</button><button class="btn quiet" data-u="keys" aria-expanded="${U.keys}">Tastenkürzel</button></div>
      ${U.keys ? `<div class="keys" style="margin-top:8px"><span><kbd>↓</kbd> <kbd>↑</kbd> bewegen</span><span><kbd>Enter</kbd> öffnen</span><span><kbd>Y</kbd> ja</span><span><kbd>N</kbd> nicht ganz</span><span><kbd>C</kbd> Gegenargument</span><span><kbd>T</kbd> heute Nacht nachdenken</span><span><kbd>P</kbd> parken</span><span><kbd>W</kbd> Woche</span><span><kbd>Alt</kbd> + Pfeiltasten verschieben eine Zeile</span></div>` : ""}</div>`;
  const from = [["Von Vera", "Die Jetzt-Liste ohne Obergrenze, die Liste mit dem, was dir sonst im Kopf ist, und lose Gedanken, die der passenden Frage zugeordnet werden."], ["Von Luca", "Das Durchdenken öffnet sich im Eintrag selbst. Quellen lassen sich öffnen und markieren. Erst das Gegenargument. Jede Entscheidung landet im heutigen Protokoll, das sich als Übergabe kopieren lässt. Mail und wartende Agenten stehen in derselben Liste wie Fragen."], ["Von Nora", "Ja oder Nicht ganz als Antwort auf einen Vorschlag von " + A_NAME + ", und die freiwillige Erinnerung, eine Entscheidung später zu überprüfen."], ["Von deinem Bildschirm", "Mehr bei einer Zeile, heute Nacht darüber nachdenken, Geparktes, fällige Rückblicke und die Tastenkürzel, alles bleibt verborgen, bis du danach fragst."], ["Von Balance", "Die Gliederung ist die Ansicht Alles. Wenn du eine Zeile öffnest, wird sie zur Seite, eingerahmt von dem, worin sie liegt, und du kannst darin Zeilen hinzufügen. Jede Zeile kann weitere Zeilen enthalten. Der Vorschlag des Systems ist die Jetzt-Liste. Seine Gründe stehen bei den Zeilen, zum Beispiel ein Bereich, der diese Woche zu kurz gekommen ist."], ["Begrüssung, für dich erledigt, Wochenrückblick", "Die Jetzt-Seite ist ein Strom. Was seit gestern neu ist, erscheint zuoberst als Karten und verschwindet, sobald du dich darum gekümmert hast: ein wartender Agent, ein Vorschlag von " + A_NAME + ", was für dich erledigt wurde, ein offener Rückblick. Für dich erledigt zeigt seine Gruppen, jede mit einem Grund und einem Rückgängig. Der Wochenrückblick besteht aus vier Dingen zum Ansehen, jedes mit einer Entscheidung."], ["Von Ranger, Routinen und Abläufen", "Bei jeder Zeile ist festgelegt, wer sie macht: du, ein Agent einmal oder eine Routine nach Plan. Ein wartender Agent, eine Routine, die erst fragt, und eine fehlgeschlagene Routine erscheinen im Strom. Abgegeben zeigt Agenten bei der Arbeit, Routinen mit ihren Schritten und Rezepte. Wenn du etwas tippst, das sich wiederholt, kommt das Angebot, es als Routine einzurichten."], ["Kalender", "Der Tag steht neben der Liste, mit der freien Zeit zwischen den Terminen. Heute einplanen legt einen Eintrag in die nächste freie Zeit, die passt. Die Woche zeigt, welche Frage zu welchem Tag gehört. Ein Termin öffnet sich und zeigt, mit wem, wo und was du ansprechen willst. Wenn er vorbei ist, fragt er einmal, ob es etwas festzuhalten gibt. Zehn Minuten vorher erscheint er zuoberst, mit dem, was du letztes Mal festgehalten hast, und der Vorbereitung von " + A_NAME + ". Bei jeder Angabe in der Vorbereitung steht der Adapter, aus dem sie stammt, und die Vorbereitung sagt, was sie nicht lesen konnte."]];
  return `<div style="display:flex;flex-direction:column;gap:26px">
    <div class="frame"><div class="bar"><b>Tag</b><span class="row"><span>Prototyp-Uhr</span><div class="seg" role="tablist" aria-label="Prototyp-Uhr">${[[640, "10:40"], [830, "13:50"], [935, "15:35"]].map(([m, l]) => `<button role="tab" aria-selected="${CAL.now === m}" data-u="clock" data-id="${m}">${l}</button>`).join("")}</div></span></div><div class="body">${body}</div></div>
    <section><h2>Was eingeflossen ist</h2><div class="find" style="grid-template-columns:minmax(0,1fr);max-width:72ch">${from.map(([k, v]) => `<p><b>${k}.</b> ${esc(v)}</p>`).join("")}</div>
      <p class="faint">Der Einstieg soll einfach sein und trotzdem viel zulassen. Der erste Bildschirm zeigt darum nur eine Liste, ein Eingabefeld und den Tag. Weggelassen wurden Noras Grenze von drei, ihre eigene Fragenseite und Lucas zweispaltiges Layout.</p></section></div>`;
}
function studioAct(a, el) {
  const id = el && el.dataset.id || U.open, it = U.items.find((x) => x.id === id), s = it && ust(it.id);
  U.toast = ""; U.copied = false;
  const done = (text) => { U.log.push(`${it.q}: ${text}`); U.items = U.items.filter((x) => x !== it); U.open = null; delete U.plan[it.id]; };
  if (a === "open") { if (it.kind !== "Task") U.open = U.open === id ? null : id; }
  else if (a === "tick") { done("erledigt"); U.toast = "Erledigt."; }
  else if (a === "src") { const i = Number(el.dataset.i); s.openSrc = s.openSrc === i ? null : i; }
  else if (a === "flag") s.flagged[s.openSrc] = true;
  else if (a === "yes") { it.fresh = false; it.stand = it.proposal; it.proposal = null; it.next = "So siehst du es jetzt. Entscheide, wenn du so weit bist."; U.toast = "Gespeichert. So siehst du es jetzt."; }
  else if (a === "notquite") s.reply = true;
  else if (a === "cancel") s.reply = false;
  else if (a === "send") { s.reply = false; it.proposal = null; it.now = false; it.why = A_NAME + " denkt heute Nacht über deine Antwort nach."; it.tonight = true; U.open = null; U.toast = "Gesendet. Es kommt morgen mit einem neuen Gedanken zurück."; }
  else if (a === "challenge") s.challenged = true;
  else if (a === "decide") { if (s.pick === null) return; const fl = Object.keys(s.flagged).map((i) => it.src[i][0]); done(`${s.pick < 2 ? it.opts[s.pick] : s.own || "eigene Entscheidung."}${fl.length ? ` (als unzuverlässig weggelassen: ${fl.join(", ")})` : ""}`); U.toast = it.kind === "Mail" ? "Entschieden. Ein Entwurf liegt in deinem Entwurfsordner." : it.kind === "Agent is waiting" ? "Entschieden. Der Agent macht weiter." : "Abgeschlossen und unter Heute entschieden festgehalten."; }
  else if (a === "close") { done(it.stand); U.toast = "Abgeschlossen und unter Heute entschieden festgehalten."; }
  else if (a === "talk") U.toast = "Hier öffnet sich ein Gespräch mit " + A_NAME + ". Wenn es endet, landet es als Zusammenfassung bei diesem Eintrag.";
  else if (a === "now") { it.now = !it.now; it.suggest = false; if (!it.now) delete U.plan[id]; if (U.open === id) U.open = null; }
  else if (a === "view") U.view = id;
  else if (a === "focus") { U.focus = id; U.open = null; }
  else if (a === "newAll") U.newAll = !U.newAll;
  else if (a === "rtOk" || a === "rtAuto" || a === "rtSkip") { const r = rtFind(el.dataset.to); r.runs.unshift(["Gerade eben", a === "rtSkip" ? "Von dir übersprungen." : "In Ordnung. Von dir freigegeben."]); r.pending = null; r.next = "nächsten Montag, 09:00"; if (a === "rtAuto") r.policy = "auto"; U.toast = a === "rtSkip" ? "Diesmal übersprungen." : a === "rtAuto" ? "Läuft. Die Routine fragt nicht mehr." : "Läuft."; }
  else if (a === "rtRetry") { const r = rtFind(el.dataset.to); r.runs.unshift(["Gerade eben", "In Ordnung. Auf deinen Wunsch nochmal gelaufen."]); r.fixed = true; r.ack = true; U.toast = "Nochmal ausgeführt. Es hat geklappt."; }
  else if (a === "rtAck") rtFind(el.dataset.to).ack = true;
  else if (a === "rtOpen") { U.view = "handed"; U.rtOpen = U.rtOpen === el.dataset.to && U.view === "handed" ? null : el.dataset.to; }
  else if (a === "rtPolicy") rtFind(el.dataset.to).policy = el.dataset.id;
  else if (a === "rtPause") { const r = rtFind(el.dataset.to); r.paused = !r.paused; }
  else if (a === "rtAsk") U.toast = A_NAME + " bereitet ein Vorher und Nachher vor. Nichts ändert sich, bevor du bestätigst.";
  else if (a === "rtMake") { const nid = "r" + Date.now(); U.rt.push({ id: nid, name: U.rtDraft, when: "Wie du es geschrieben hast", next: "sobald du die Schritte bestätigt hast", policy: "ask", steps: [[A_NAME + " erarbeitet die Schritte und zeigt sie dir vor dem ersten Lauf", A_NAME]], runs: [] }); U.rtDraft = null; U.view = "handed"; U.rtOpen = nid; U.toast = "Eingerichtet. Die Routine fragt dich vor jedem Lauf."; }
  else if (a === "rtKeep") { U.items.push({ id: "u" + Date.now(), kind: "Question", now: false, area: "me", model: "cloud", tonight: false, q: U.rtDraft, why: "Gerade hinzugefügt." }); U.rtDraft = null; U.toast = "Als Gedanken festgehalten."; }
  else if (a === "hand") { it.who = "agent"; it.doing = "Gerade gestartet"; it.why = "Ein Agent arbeitet daran."; U.toast = "Abgegeben. Es kommt wieder nach oben, wenn der Agent dich braucht oder fertig ist."; }
  else if (a === "clock") { CAL.now = Number(id); U.open = null; }
  else if (a === "soonDone") U.soonDone[el.dataset.to] = true;
  else if (a === "evsrc") U.evSrc = U.evSrc === el.dataset.to ? null : el.dataset.to;
  else if (a === "brief") U.briefOpen[el.dataset.to] = true;
  else if (a === "ev") U.ev = U.ev === el.dataset.to ? null : el.dataset.to;
  else if (a === "raise") {
    const v = $("#u-raise").value.trim(), ev = evFind(U.ev); if (!v || !ev) return;
    const words = vWords(v), hit = U.items.find((x) => !ev.raise.includes(x.id) && vWords(x.q).some((w) => words.includes(w)));
    if (hit) { ev.raise.push(hit.id); U.toast = `Mit deiner Frage verknüpft: ${hit.q}`; } else ev.notes.push(v);
  }
  else if (a === "afterKeep") {
    const v = $("#u-after").value.trim(), ev = evFind(U.after); if (!v) return;
    const nid = "m" + Date.now(), proj = "Aus " + ev.t; (ev.kept ||= []).push(v);
    U.items.push({ id: nid, kind: "Task", proj, now: false, area: ev.area, model: "cloud", tonight: false, q: v, why: `Aus ${ev.t}, heute.` });
    if (!U.nodes.some((n) => n.id === "p-" + ev.area + "-" + proj)) U.nodes.push({ id: "p-" + ev.area + "-" + proj, parent: "a-" + ev.area, title: proj, w: 50 });
    U.nodes.push({ id: nid, parent: "p-" + ev.area + "-" + proj, item: true, w: 50 });
    U.toast = "Festgehalten. Füg noch etwas hinzu, oder drück auf Nichts festzuhalten, wenn du fertig bist.";
  }
  else if (a === "afterNone") { U.after = null; }
  else if (a === "seen") it.fresh = false;
  else if (a === "dfyDismiss") { U.dfy.card = false; U.toast = "Weggelegt. Es bleibt unten unter Für dich erledigt."; }
  else if (a === "dfyBack") { U.dfy.card = true; U.view = "day"; }
  else if (a === "revLater") { U.rev.card = false; U.toast = "Heute nicht. Der Rückblick bleibt unten unter Wochenrückblick."; }
  else if (a === "rowmenu") U.rowMenu = U.rowMenu === el.dataset.to ? null : el.dataset.to;
  else if (a === "mv") { if (nShift(U.rowMenu, el.dataset.to)) U.toast = "Verschoben."; }
  else if (a === "dfy") U.dfy.open = !U.dfy.open;
  else if (a === "dfyShow") U.dfy.show = U.dfy.show === el.dataset.to ? null : el.dataset.to;
  else if (a === "dfyUndo") { U.dfy.groups.find((g) => g.id === el.dataset.to).undone = true; U.toast = "Rückgängig gemacht."; }
  else if (a === "dfyStop") { U.dfy.groups.find((g) => g.id === el.dataset.to).stopped = true; U.toast = A_NAME + " fragt dich ab jetzt zuerst."; }
  else if (a === "revSeen") U.rev.seen = true;
  else if (a === "revArea") { U.rev.area[el.dataset.id] = el.dataset.to; if (el.dataset.to === "lower") { const ar = U.areas.find((x) => x.id === el.dataset.id); ar.w = Math.max(5, Math.round(ar.w / 2)); } }
  else if (a === "revStale") U.rev.stale.find((s) => s.id === el.dataset.id).a = el.dataset.to;
  else if (a === "revCheck") U.rev.checks.find((c) => c.id === el.dataset.id).a = el.dataset.to;
  else if (a === "revClose") { U.rev.closed = true; U.view = "day"; U.toast = "Rückblick abgeschlossen. Der Vorschlag vom Montag richtet sich danach."; }
  else if (a === "drill") { U.at = el.dataset.to || null; U.treeMore = false; }
  else if (a === "treeMore") U.treeMore = !U.treeMore;
  else if (a === "addrow") {
    const v = $("#u-add").value.trim(), cur = U.nodes.find((n) => n.id === U.at); if (!v || !cur) return;
    const nid = "n" + Date.now();
    U.items.push({ id: nid, kind: "Task", now: false, area: nArea(cur).id, model: "cloud", tonight: false, q: v, why: "Gerade hinzugefügt." });
    U.nodes.push({ id: nid, parent: cur.id, item: true, w: 50 });
    U.toast = `Zu ${nTitle(cur)} hinzugefügt.`;
  }
  else if (a === "plan") { const gs = calGaps().filter((g) => !g.past); const g = gs.find((x) => x.left >= est(id)) || gs.at(-1); if (g) { U.plan[id] = g.i; U.toast = `Eingeplant um ${hm(g.start)}.`; } }
  else if (a === "later") { if (calGaps()[U.plan[id] + 1]) U.plan[id]++; }
  else if (a === "unplan") delete U.plan[id];
  else if (a === "jump") { U.view = "day"; if (it.now) U.open = id; else U.toast = "Diese Frage liegt unter Ausserdem im Kopf. Drück auf Jetzt, um sie hervorzuholen."; }
  else if (a === "more") U.more = U.more === id ? null : id;
  else if (a === "tonight") it.tonight = !it.tonight;
  else if (a === "keys") U.keys = !U.keys;
  else if (a === "add") {
    const v = $("#u-new").value.trim(); if (!v) return;
    if (/(^|[^a-zäöü])(jede[ns]?|täglich|wöchentlich|monatlich)(?![a-zäöü])/i.test(v)) { U.rtDraft = v; return; }
    const words = vWords(v), hit = U.items.find((x) => vWords(x.q + " " + (x.read || "")).some((w) => words.includes(w)));
    if (hit) U.merge = { text: v, id: hit.id };
    else { U.items.push({ id: "u" + Date.now(), kind: "Question", now: false, area: "me", model: "cloud", tonight: false, q: v, why: "Gerade hinzugefügt." }); U.toast = "Festgehalten. Es steht in der Liste unten."; }
  }
  else if (a === "mergeYes") { U.merge = null; U.toast = "Zu dieser Frage hinzugefügt. " + A_NAME + " bringt es nächstes Mal zur Sprache."; }
  else if (a === "mergeNo") { U.items.push({ id: "u" + Date.now(), kind: "Question", now: false, area: "me", model: "cloud", tonight: false, q: U.merge.text, why: "Gerade hinzugefügt." }); U.merge = null; U.toast = "Als eigene Frage festgehalten."; }
  else if (a === "copy") { const txt = U.log.map((h) => "- " + h).join("\n"); try { navigator.clipboard.writeText(txt).catch(() => {}); } catch (e) {} U.copied = true; }
}
document.addEventListener("change", (e) => { if (e.target.name === "u-opt") { const s = ust(U.open); s.pick = Number(e.target.value); s.challenged = false; render(); } });
document.addEventListener("input", (e) => { if (e.target.id === "u-own") ust(U.open).own = e.target.value; });

/* ---------- Scenario packs: everything a scenario owns. The functions above are shared. ---------- */
const SCENARIO_LIST = [
  { key: "coach", label: "Coaching und Therapie", blurb: "Selbständig, mit Einzelpersonen, Paaren, Gruppen und Schulen.",
    intro: "Stell dir vor, du arbeitest selbständig als Coach für Gewaltfreie Kommunikation, mit Einzelpersonen, Paaren, Gruppen und Schulen. Es ist Mittwochvormittag, 10:40." },
  { key: "knowledge", label: "Wissensarbeit", blurb: "Selbständige Sicherheitsberatung, dazu ein Abendkurs und jede Woche ein Artikel.",
    intro: "Stell dir vor, du berätst selbständig Firmen und Gemeinden zur Informationssicherheit. Daneben unterrichtest du einen Abendkurs und schreibst jede Woche einen Artikel. Es ist Mittwochvormittag, 10:40." },
  { key: "manager", label: "Führung", blurb: "Ein Team von acht Personen in einer mittelgrossen Firma leiten.",
    intro: "Stell dir vor, du leitest in einer mittelgrossen Firma ein Team von acht Personen. Es ist Mittwochvormittag, 10:40." },
  { key: "dev", label: "Softwareentwicklung", blurb: "In einem kleinen Produktteam entwickeln, zusammen mit Coding-Agenten.",
    intro: "Stell dir vor, du entwickelst Software in einem kleinen Produktteam und gibst einen Teil der Arbeit an Agenten ab. Es ist Mittwochvormittag, 10:40." },
];
const itm = (id, kind, area, now, o) => ({ id, kind, now, area, model: "cloud", tonight: false, ...o });
const MTG_TIMES = { m1: [540, 630], m2: [750, 795], m3: [840, 930], m4: [1020, 1080] };
const mtg = (id, t, o) => ({ s: MTG_TIMES[id][0], e: MTG_TIMES[id][1], t, id, raise: [], notes: [], ...o });
const packEst = () => ({ ws: 45, rate: 20, probono: 15, inv: 10, print: 10 });
/* The walk-through texts. g carries what differs per scenario; the rest is the same in every pack. */
const packGuide = (A, ex, g) => ({
  first: { task: "Schau dir die Seite eine halbe Minute an, ohne etwas anzuklicken. Wofür ist sie da, und was würdest du als Erstes tun?" },
  suggest: { task: `${A}, deine Assistenz, hat einen Vorschlag ${g.suggestTopic}. Lies ihn und antworte darauf.`,
    hint: `Die Karte ${g.suggestCard} steht oben unter «Neu seit gestern». Unten in der Karte sind zwei Knöpfe: «Ja, so sehe ich das» und «Nicht ganz».` },
  decide: { task: `${g.decide} Schau dir an, worauf er sich stützt, und lass dir zeigen, was gegen deine Wahl spricht. Entscheide dann.`,
    hint: "Öffne die Karte mit «Durchdenken». Wähle eine Möglichkeit, drücke «Erst das Gegenargument» und entscheide danach mit «Entscheiden und dem Agenten sagen»." },
  capture: { task: `Dir fällt gerade ein: «${ex.merge}». Halte das fest.`,
    hint: `Tippe den Satz oben ins Eingabefeld und drücke «Festhalten». Schau, was ${A} dann vorschlägt.` },
  plan: { task: `${g.plan} Plane das in deinen Tag ein. Dann überlegst du es dir anders und willst es lieber später am Tag machen.`,
    hint: "Auf der Karte gibt es «Heute einplanen». Die Aufgabe erscheint dann rechts im Kalender. Dort gibt es «Später»." },
  dfy: { task: `${A} hat seit gestern einiges selbständig erledigt. Finde heraus, was. Mach dann das Aufräumen der Mails rückgängig.`,
    hint: "Suche die Karte «Für dich erledigt». Falls du sie nicht siehst, gibt es unter «Neu seit gestern» einen Knopf, der weitere Karten zeigt. Bei «Mail aufgeräumt» gibt es «Rückgängig»." },
  meeting: { task: `Um 14:00 hast du ${g.meeting}. Stell die Prototyp-Uhr oben rechts auf 13:50. Was weisst du jetzt über den Termin, und woher stammen die Angaben?`,
    hint: "Die Uhr ist oben rechts im grauen Balken. Danach erscheint zuoberst eine neue Karte. Klick dort auf die kleinen Quellen-Schilder." },
  tree: { task: `Du möchtest sehen, was im Bereich ${g.area} alles ansteht. Ergänze dann ${g.projIn} eine neue Zeile: «${ex.row}».`,
    hint: `Wechsle oben von «Tag» zu «Alles». Öffne «${g.area}», dann «${g.proj}». Unten ist ein Eingabefeld, daneben «Hinzufügen».` },
  routine: { task: `Du willst, dass ${g.routineWish}. Richte das ein.`,
    hint: `Schreib es oben ins Eingabefeld, so wie du es sagen würdest: «${ex.routine}». Drücke «Festhalten» und danach «Als Routine einrichten».` },
  review: { task: "Schau dir den Wochenrückblick an und geh ihn durch.",
    hint: "Ganz unten auf der Seite gibt es «Wochenrückblick». Jeder der vier Teile braucht eine Antwort von dir. Am Schluss drückst du «Rückblick abschliessen»." },
});

const SCENARIOS = {
  coach: (A) => {
    const examples = { merge: "Schulleiterin nach einem Beispiel fragen", routine: "jeden Freitag die offenen Offerten auflisten", row: "Raum reservieren" };
    return {
      areas: [{ id: "clients", label: "Kundschaft", w: 40, got: 55 }, { id: "business", label: "Geschäft", w: 30, got: 38 }, { id: "me", label: "Ich", w: 30, got: 7 }],
      proj: { ws: "Schul-Workshop", probono: "Elternverein", rate: "Praxis", inv: "Praxis", train: "Weiterbildung", evening: "Angebote", news: "Angebote" },
      est: packEst(),
      items: [
        itm("ws", "Question", "clients", true, { q: "Wie eröffne ich den Konflikt-Workshop für das Schulteam?", why: "Der Workshop ist in fünf Tagen.", next: "Offener Punkt vom Montag: Wer bringt das Beispiel mit?",
          prior: { when: "Am Montag im Gespräch geklärt", before: "Mit der Theorie beginnen, dann üben.", after: "Mit einem echten Beispiel aus dem Team beginnen. Die vier Schritte kommen nach der Pause.",
            settled: ["Mit einem echten Beispiel beginnen statt mit Theorie.", "Die vier Schritte erst nach der Pause."], open: ["Wer bringt das Beispiel mit, du oder die Schulleiterin?"],
            turns: [["Du", "Ich beginne eigentlich immer mit den vier Schritten. Bei diesem Team weiss ich aber nicht, ob das ankommt."], [A, "Zwei Lehrpersonen haben gesagt, dass sie die Theorie schon kennen. Was haben sie sich gewünscht?"], ["Du", "Etwas aus ihrem eigenen Lehrerzimmer."], [A, "Dann fang dort an. Wer könnte dieses Beispiel mitbringen?"]] },
          read: "Die Schulleiterin hat am Freitag geschrieben, dass sie vor dem Workshop zehn Minuten Zeit für dich hat. Laut deinen Notizen vertraut das Team ihr, und zwei Lehrpersonen sind externen Trainern gegenüber skeptisch. Dort steht auch, dass sich das Team ein Beispiel aus dem eigenen Lehrerzimmer wünscht.",
          src: [["Mail der Schulleiterin, Fr", "Ich kann dich um 8:20 treffen, zehn Minuten bevor wir anfangen."], ["deine Notizen, erstes Gespräch", "Team vertraut der Schulleiterin. Zwei Lehrpersonen skeptisch gegenüber externen Trainern."]],
          opts: ["Ich bitte die Schulleiterin, das Beispiel mitzubringen.", "Ich bringe ein Beispiel aus einer anderen Schule mit."],
          counter: ["Wenn das Beispiel von ihr kommt, hört das Team darin vielleicht ihre Sicht auf einen Konflikt, an dem es selbst beteiligt ist.", "Die zwei skeptischen Lehrpersonen haben sich etwas aus ihrem eigenen Lehrerzimmer gewünscht."] }),
        itm("rate", "Question", "business", true, { q: "Erhöhe ich mein Honorar für den Frühlingsblock?", why: "Zwei Klientinnen haben diese Woche nach Terminen im Frühling gefragt.", next: `${A} hat einen Vorschlag für dich.`,
          stand: "Ich lasse es wohl besser, wie es ist.", proposal: "Das Honorar für neue Buchungen um 8 Prozent erhöhen. Für die zwei, die schon gefragt haben, gilt das alte Honorar.",
          read: "Beide Klientinnen, die nach Terminen im Frühling gefragt haben, haben letztes Jahr das Honorar ohne Rückfrage bezahlt. Deine Raummiete und deine Versicherung sind seither um etwa 6 Prozent gestiegen.",
          src: [["Rechnungen, letzte 12 Monate", "14 Rechnungen zum aktuellen Honorar. Niemand hat einen Rabatt verlangt oder bekommen."], ["zwei Mails diese Woche", "Beide fragen nach Terminen im März. Keine erwähnt den Preis."], ["Abrechnungen für Miete und Versicherung", "Raummiete ab Januar 5 Prozent höher, Versicherung 9 Prozent höher."]] }),
        itm("probono", "Mail", "clients", true, { q: "Anfrage: ein kostenloser Workshop für den Elternverein", why: "Die Anfrage ist neun Tage alt.", next: "Braucht eine Antwort. Sobald du entschieden hast, kann eine Antwort entworfen werden.",
          read: "Sie fragen nach einem kostenlosen Abend im Januar. Du hast dieses Jahr zwei kostenlose Abende gegeben und im September geschrieben, dass zwei deine Grenze sind.",
          src: [["Mail des Elternvereins, 2. Nov.", "Wir haben kein Budget, aber 40 Eltern würden kommen."], ["deine Notiz, September", "Pro bono: zwei pro Jahr. Beide vergeben."]],
          opts: ["Absagen und die bezahlte Abendgruppe zu einem reduzierten Honorar anbieten.", "Noch einmal zusagen, weil ich so an die Schule herankomme."],
          counter: ["40 Eltern sind das grösste Publikum, das dir dieses Jahr angeboten wurde.", "Mit einer Zusage brichst du die Grenze, die du dir vor acht Wochen im September gesetzt hast."] }),
        itm("inv", "Agent is waiting", "business", true, { q: "Drei Rechnungen sind überfällig. Zahlungserinnerungen senden?", why: "Der Agent hat drei Zahlungserinnerungen vorbereitet und sendet sie nicht von sich aus.", next: "Er macht weiter, sobald du entschieden hast.",
          read: "Zwei Rechnungen sind 20 Tage überfällig. Die dritte ist 35 Tage überfällig, von einer Klientin, die du am Donnerstag wieder siehst.",
          src: [["offene Rechnungen", "Zwei mit 20 Tagen, eine mit 35 Tagen."], ["Kalender, Donnerstag", "Sitzung mit der dritten Klientin um 14:00."]],
          opts: ["Alle drei Zahlungserinnerungen senden.", "Zwei senden. Die dritte spreche ich am Donnerstag persönlich an."],
          counter: ["Die dritte Klientin bekommt eine formelle Zahlungserinnerung, einen Tag bevor sie bei dir im Raum sitzt.", "Diese Klientin war schon im Frühling im Verzug, und du hast es damals nicht angesprochen."] }),
        itm("train", "Question", "me", false, { suggest: true, tonight: true, q: "Soll ich die Mediationsausbildung machen?", why: "Der Bereich Ich ist diese Woche zu kurz gekommen. Der Frühbucherpreis gilt bis Dienstag." }),
        itm("evening", "Question", "business", false, { q: "Biete ich die Abendgruppe wieder an?", why: "Die Anmeldung würde im Januar öffnen." }),
        itm("news", "Question", "business", false, { q: "Was kommt in den Januar-Newsletter?", who: "agent", doing: "Entwirft seit 09:12 drei Themenideen aus den Fragen des letzten Quartals", why: "Ein Agent entwirft Ideen dazu." }),
        itm("print", "Task", "clients", true, { proj: "Schul-Workshop", q: "Workshop-Handout in den Druck geben", why: "Fällig am Freitag.", next: "Dauert zehn Minuten und ist am Freitag fällig." }),
        itm("room", "Task", "business", false, { proj: "Praxis", q: "Raumvertrag verlängern", why: "Fällig am 30. November." }),
        itm("walk", "Task", "me", false, { proj: "Gesundheit", q: "Physiotermin buchen", why: "Ohne Datum." }),
      ],
      day: [
        mtg("m1", "Klientensitzung", { area: "clients", with: "Jonas, Einzelsitzung", where: "Praxisraum" }),
        mtg("m2", "Mittagessen mit Mara", { area: "me", with: "Mara", where: "Café am Bahnhof" }),
        mtg("m3", "Paarsitzung", { area: "clients", with: "Ein Paar, dritte Sitzung", where: "Praxisraum", notes: ["Fragen, wie die Zuhörübung gelaufen ist"],
          last: { when: "Zweite Sitzung, 28. Oktober", from: "Notizordner", kept: ["Sie haben eine Zuhörübung pro Tag vereinbart.", "Er war zurückhaltend. Zuerst bei ihm nachfragen."] },
          brief: { at: "13:45", text: "Das ist die dritte Sitzung. Letztes Mal haben sie eine Zuhörübung pro Tag vereinbart, und du wolltest fragen, wie es gelaufen ist. Sie hat am 1. November geschrieben, dass sie über den Umzug sprechen möchte. Das war noch in keiner Sitzung Thema.",
            src: [["Kalender", "desk-ics", "Paarsitzung, 14:00 bis 15:30, Praxisraum. Dritte der Reihe."], ["Notizen", "Notizordner", "28. Okt.: Vereinbart: eine Zuhörübung pro Tag. Er war zurückhaltend."], ["Mail", "desk-imap", "1. Nov.: Könnten wir nächstes Mal über den Umzug sprechen?"]], missing: [] } }),
        mtg("m4", "Abendgruppe", { area: "clients", with: "Sechs Personen", where: "Online", join: true, raise: ["evening"],
          last: { when: "4. November", from: "Notizordner", kept: ["Zwei Personen haben um einen späteren Beginn gebeten."] },
          brief: { at: "16:45", text: "Sechs Personen sind angemeldet. Letzte Woche haben zwei um einen späteren Beginn gebeten. Das passt zu deiner offenen Frage, ob du die Gruppe wieder anbietest.",
            src: [["Kalender", "desk-ics", "Abendgruppe, wöchentlich, online."], ["Notizen", "Notizordner", "4. Nov.: Zwei Personen haben um einen späteren Beginn gebeten."]], missing: [`Der Gruppenchat hat in Threva keinen Adapter, darum hat ${A} ihn nicht gelesen.`] } }),
      ],
      week: [
        { d: "Mi 11", today: true, ev: [["9:00", "Klientensitzung"], ["12:30", "Mittagessen mit Mara"], ["14:00", "Paarsitzung"], ["17:00", "Abendgruppe"]], link: [] },
        { d: "Do 12", ev: [["9:00", "Klientensitzung"], ["14:00", "Sitzung mit der Klientin, die spät zahlt"]], link: [["inv", "Überfällige Rechnung: hier ansprechen?"]] },
        { d: "Fr 13", ev: [["10:00", "Supervisionsgruppe"]], link: [] },
        { d: "Sa 14", ev: [], link: [] },
        { d: "So 15", ev: [], link: [] },
        { d: "Mo 16", ev: [["8:20", "Schulleiterin, zehn Minuten"], ["8:30", "Konflikt-Workshop, Schulteam"]], link: [["ws", "Wie eröffne ich den Workshop?"]] },
        { d: "Di 17", ev: [["18:00", "Abendgruppe"]], link: [["train", "Frühbucherpreis für die Ausbildung endet"]] },
      ],
      dfy: [
        { id: "mail", label: "Mail aufgeräumt", n: 11, why: "Du hast solche Mails dreimal als unwichtig markiert.", items: ["9 Mails aus zwei Newsletter-Sammlungen gelöscht", "2 Buchungsbestätigungen archiviert"] },
        { id: "agent", label: "Agenten-Aufgaben wiederholt", n: 1, why: "Du hast für fehlgeschlagene Aufgaben einen zweiten Versuch erlaubt.", items: ["Der Rechnungsexport ist um 06:10 fehlgeschlagen und hat beim zweiten Versuch geklappt"] },
        { id: "file", label: "Gedanken abgelegt", n: 2, why: "Beide passten zu einer Frage, die du schon hast.", items: ["«Nach Parkplätzen bei der Schule fragen» kam zu Schul-Workshop", "«Brief zur Raummiete» kam zu Praxis"] },
        { id: "rt", label: "Routinen gelaufen", n: 12, why: "Sie sind so eingestellt, dass sie selbständig laufen.", items: ["Mail-Zusammenfassung am Morgen: in Ordnung", "Buchungsseite: 42 Prüfungen seit Mitternacht, keine neue Anfrage", "Sicherung um 22:00 fehlgeschlagen; siehe Karte oben"] },
      ],
      rev: { wins: { total: 9, by: "Kundschaft 5 · Geschäft 3 · Ich 1", top: ["Erstes Gespräch mit dem Schulteam geführt", "Frühlingstermine an zwei Klientinnen geschickt", "Buchhaltung für September abgeschlossen"] },
        stale: [{ id: "s1", q: "Neuer Website-Text für das Paarcoaching", age: "seit fünf Wochen unberührt", a: null }, { id: "s2", q: "Welche drei Klientinnen frage ich nach einer Empfehlung?", age: "seit vier Wochen unberührt", a: null }],
        checks: [{ id: "c1", q: "Keine einzelnen Probesitzungen mehr anbieten", on: "entschieden am 2. September", expect: "Nicht weniger Erstbuchungen im Oktober.", a: null }] },
      rt: [
        { id: "r1", name: "Morgens neue Mails der Kundschaft zusammenfassen", when: "Jeden Werktag um 07:30", next: "morgen, 07:30", policy: "auto", recipe: "Neue Mails zusammenfassen",
          steps: [["Ungelesene Mails der Kundschaft lesen", "Mail · desk-imap"], ["Jedes Mail in zwei Zeilen zusammenfassen", A], ["Die Zusammenfassung zuoberst in den Tag stellen", "Threva"]], runs: [["Heute, 07:30", "In Ordnung. Drei Mails zusammengefasst."], ["Gestern, 07:30", "In Ordnung. Ein Mail zusammengefasst."]] },
        { id: "r2", name: "Terminseite auf der Website aktualisieren", when: "Jeden Montag um 09:00", next: "wartet auf dich", policy: "ask", pending: "Die Routine will die zwei Frühlingstermine veröffentlichen, die du letzte Woche an Klientinnen geschickt hast.",
          steps: [["Bestätigte Termine lesen", "Kalender · desk-ics"], ["Neue Terminseite schreiben", A], ["Seite veröffentlichen", "Website · noch kein Adapter, per Mail an deinen Webhoster"]], runs: [["Montag, 09:00", "Wartet auf deine Freigabe."], ["2. November", "In Ordnung. Seite veröffentlicht."]] },
        { id: "r3", name: "Sitzungsnotizen sichern", when: "Jeden Tag um 22:00", next: "heute, 22:00", policy: "auto", failed: "Gestern um 22:00 war der Sicherungsordner nicht erreichbar. Die Notizen sind unverändert, es ging nichts verloren.",
          steps: [["Heute geänderte Notizen sammeln", "Notizen · Notizordner"], ["In den Sicherungsordner kopieren", "Dateien · Sicherungslaufwerk"]], runs: [["Gestern, 22:00", "Fehlgeschlagen. Der Sicherungsordner war nicht erreichbar."], ["9. November, 22:00", "In Ordnung. Vier Notizen kopiert."]] },
        { id: "r4", name: "Buchhaltung am Freitag: unbezahlte Rechnungen auflisten", when: "Jeden Freitag um 16:00", next: "Freitag, 16:00", policy: "auto", recipe: "An überfällige Rechnungen erinnern",
          steps: [["Offene Rechnungen lesen", "Buchhaltung · noch kein Adapter, aus einer Tabelle"], ["Alle auflisten, die älter als 14 Tage sind", A], ["Die Liste einem Agenten übergeben, der Zahlungserinnerungen vorbereitet", "Agent"]], runs: [["6. November, 16:00", "In Ordnung. Drei Rechnungen aufgelistet."]] },
        { id: "r5", name: "Buchungsseite beobachten", when: "Alle 15 Minuten", next: "in ein paar Minuten", policy: "auto", background: true,
          steps: [["Buchungsseite auf neue Anfragen prüfen", "Website"], ["Mir nur melden, wenn es eine gibt", "Threva"]], runs: [["Heute", "42 Prüfungen, keine neue Anfrage."]] },
      ],
      recipes: [["Neue Mails zusammenfassen", 3, "Morgens neue Mails der Kundschaft zusammenfassen"], ["An überfällige Rechnungen erinnern", 3, "Buchhaltung am Freitag"]],
      examples,
      guide: packGuide(A, examples, { suggestTopic: "zu deinem Honorar", suggestCard: "zum Honorar",
        decide: "Ein Agent hat Zahlungserinnerungen für drei überfällige Rechnungen vorbereitet und wartet auf dich.",
        plan: "Du willst das Handout für den Workshop heute noch zum Drucken schicken.", meeting: "eine Paarsitzung",
        area: "Kundschaft", proj: "Schul-Workshop", projIn: "beim Schul-Workshop", routineWish: "jeden Freitag automatisch die offenen Offerten aufgelistet werden" }),
    };
  },

  knowledge: (A) => {
    const examples = { merge: "Kommunikationsleiterin wegen der Presse fragen", routine: "jeden Montag die neuen Anfragen auflisten", row: "Sitzungszimmer reservieren" };
    return {
      areas: [{ id: "clients", label: "Mandate", w: 45, got: 58 }, { id: "business", label: "Lehre", w: 25, got: 30 }, { id: "me", label: "Ich", w: 30, got: 12 }],
      proj: { ws: "Krisenübung", probono: "Anfragen", rate: "Workshop-Angebot", inv: "Gemeindeprojekt", train: "Weiterbildung", evening: "Abendkurs", news: "Wochenartikel" },
      est: packEst(),
      items: [
        itm("ws", "Question", "clients", true, { q: "Wie baue ich die Krisenübung für die Geschäftsleitung auf?", why: "Das Kickoff ist heute um 14:00.", next: "Offener Punkt vom Montag: Wer spielt die Presse?",
          prior: { when: "Am Montag im Gespräch geklärt", before: "Mit dem Krisenhandbuch beginnen, dann üben.", after: "Mit einem realistischen Vorfall beginnen. Das Krisenhandbuch kommt erst in der Auswertung.",
            settled: ["Mit einem realistischen Vorfall beginnen statt mit dem Handbuch.", "Das Krisenhandbuch erst in der Auswertung."], open: ["Wer spielt die Presse, du oder jemand aus der Firma?"],
            turns: [["Du", "Sonst fange ich immer mit dem Krisenhandbuch an. Ob das bei dieser Geschäftsleitung ankommt, weiss ich nicht so recht."], [A, "Im Vorgespräch haben zwei gesagt, dass sie das Handbuch kennen. Was haben sie sich gewünscht?"], ["Du", "Etwas, das bei ihnen wirklich passieren könnte."], [A, "Dann fang dort an. Wer könnte in der Übung die Presse spielen?"]] },
          read: "Sara hat am Freitag geschrieben, dass die Kommunikationsleiterin am Übungstag frei wäre. In deinen Notizen steht, dass die Geschäftsleitung das Krisenhandbuch kennt und zwei Mitglieder solche Übungen für Theater halten. Gewünscht haben sie sich einen Vorfall, der bei ihnen wirklich passieren könnte.",
          src: [["Mail von Sara, Fr", "Unsere Kommunikationsleiterin wäre am Übungstag frei, falls du sie brauchst."], ["deine Notizen, Vorgespräch", "Geschäftsleitung kennt das Handbuch. Zwei halten Übungen für Theater."]],
          opts: ["Ich bitte die Kommunikationsleiterin, die Presse zu spielen.", "Ich spiele die Presse selbst."],
          counter: ["In einer echten Krise müsste sie der Presse selbst antworten. Wenn sie die Presse spielt, übt sie ihre eigene Rolle nicht.", "Du leitest die Übung und kannst dann nicht gleichzeitig beobachten, wie die Geschäftsleitung entscheidet."] }),
        itm("rate", "Question", "business", true, { q: "Biete ich den Workshop als halben oder als ganzen Tag an?", why: "Zwei Firmen haben diese Woche nach dem Workshop gefragt.", next: `${A} hat einen Vorschlag für dich.`,
          stand: "Ich biete wohl besser weiter beides an.", proposal: "Den Workshop neu nur noch als ganzen Tag anbieten. Für die zwei Firmen, die schon gefragt haben, gilt noch beides.",
          read: "Von neun Workshops in den letzten zwölf Monaten waren sechs ganztägig. Nach allen drei Halbtagen hast du notiert, dass die Zeit für die Übung am Schluss nicht gereicht hat.",
          src: [["Buchungen, letzte 12 Monate", "Neun Workshops: sechs ganztägig, drei halbtägig."], ["deine Notizen nach den Halbtagen", "Dreimal notiert: Die Übung am Schluss kam zu kurz."], ["zwei Anfragen diese Woche", "Beide fragen nach Terminen im Januar. Keine nennt eine Dauer."]] }),
        itm("probono", "Mail", "clients", true, { q: "Anfrage: ein kostenloser Gastvortrag beim Gewerbeverein", why: "Die Anfrage ist neun Tage alt.", next: "Braucht eine Antwort. Sobald du entschieden hast, kann eine Antwort entworfen werden.",
          read: "Sie fragen nach einem kostenlosen Vortrag im Januar. Du hast dieses Jahr zwei kostenlose Vorträge gehalten und im September geschrieben, dass zwei deine Grenze sind.",
          src: [["Mail des Gewerbevereins, 2. Nov.", "Ein Honorar können wir nicht zahlen, aber es kommen rund 60 Firmen aus der Region."], ["deine Notiz, September", "Kostenlose Vorträge: zwei pro Jahr. Beide vergeben."]],
          opts: ["Absagen und einen bezahlten Vortrag zu einem reduzierten Honorar anbieten.", "Noch einmal zusagen, weil ich so an neue Mandate komme."],
          counter: ["60 Firmen sind das grösste Publikum, das dir dieses Jahr angeboten wurde.", "Mit einer Zusage brichst du die Grenze, die du dir vor acht Wochen im September gesetzt hast."] }),
        itm("inv", "Agent is waiting", "clients", true, { q: "Der Statusbericht für das Gemeindeprojekt ist bereit. Senden?", why: "Der Agent hat den Wochenbericht vorbereitet und sendet ihn nicht von sich aus.", next: "Er macht weiter, sobald du entschieden hast.",
          read: "Der Bericht zeigt, dass die Einführung der Zwei-Faktor-Anmeldung zwei Wochen im Verzug ist. Am Donnerstag sitzt du mit dem Auftraggeber im Lenkungsausschuss.",
          src: [["Entwurf des Statusberichts", "Zwei-Faktor-Anmeldung: geplant 13. Nov., neu 27. Nov."], ["Kalender, Donnerstag", "Lenkungsausschuss Gemeindeprojekt um 14:00."]],
          opts: ["Den Bericht jetzt senden, mit dem Verzug darin.", "Zurückhalten. Ich erkläre den Verzug am Donnerstag selbst und sende den Bericht danach."],
          counter: ["Der Auftraggeber liest einen Tag vor eurer Sitzung von zwei Wochen Verzug und hat deine Erklärung dazu noch nicht gehört.", "Der Bericht kommt sonst jeden Mittwoch. Wenn er diese Woche fehlt, fällt das wahrscheinlich stärker auf als der Verzug."] }),
        itm("train", "Question", "me", false, { suggest: true, tonight: true, q: "Soll ich die Zertifizierung für Informationssicherheit machen?", why: "Der Bereich Ich ist diese Woche zu kurz gekommen. Der Frühbucherpreis gilt bis Dienstag." }),
        itm("evening", "Question", "business", false, { q: "Unterrichte ich den Abendkurs im nächsten Semester wieder?", why: "Die Schule möchte bis Januar Bescheid wissen." }),
        itm("news", "Question", "business", false, { q: "Worüber schreibe ich den nächsten Artikel?", who: "agent", doing: "Entwirft seit 09:12 drei Themenideen aus den Sicherheitsmeldungen der Woche", why: "Ein Agent entwirft Ideen dazu." }),
        itm("print", "Task", "clients", true, { proj: "Gemeindeprojekt", q: "Folien für Donnerstag exportieren", why: "Fällig am Donnerstag.", next: "Dauert zehn Minuten und ist am Donnerstag fällig." }),
        itm("room", "Task", "business", false, { proj: "Abendkurs", q: "Prüfungstermin mit dem Kurssekretariat festlegen", why: "Fällig am 30. November." }),
        itm("walk", "Task", "me", false, { proj: "Gesundheit", q: "Zahnarzttermin buchen", why: "Ohne Datum." }),
      ],
      day: [
        mtg("m1", "Projekt-Stand-up", { area: "clients", with: "Lea und Tim, Gemeindeprojekt", where: "Gemeindehaus, Sitzungszimmer 2" }),
        mtg("m2", "Mittagessen mit Mara", { area: "me", with: "Mara", where: "Café am Bahnhof" }),
        mtg("m3", "Kickoff Krisenübung", { area: "clients", with: "Sara und Nico aus der Geschäftsleitung", where: "Beim Kunden, Sitzungszimmer", notes: ["Fragen, wer die Presse spielt"],
          last: { when: "Vorgespräch, 28. Oktober", from: "Notizordner", kept: ["Die Übung dauert einen halben Tag.", "Nico will kein Szenario mit Stromausfall. Das hatten sie schon."] },
          brief: { at: "13:45", text: "Das ist das Kickoff für die Krisenübung. Im Vorgespräch habt ihr einen halben Tag vereinbart, und Nico wollte kein Szenario mit Stromausfall. Sara hat am 1. November geschrieben, dass der Verwaltungsrat zuschauen möchte. Das war noch nicht besprochen.",
            src: [["Kalender", "desk-ics", "Kickoff Krisenübung, 14:00 bis 15:30, beim Kunden."], ["Notizen", "Notizordner", "28. Okt.: Halber Tag vereinbart. Nico: kein Stromausfall, das hatten sie schon."], ["Mail", "desk-imap", "1. Nov.: Der Verwaltungsrat würde bei der Übung gern zuschauen. Geht das?"]], missing: [] } }),
        mtg("m4", "Abendkurs", { area: "business", with: "22 Studierende", where: "Online", join: true, raise: ["evening"],
          last: { when: "4. November", from: "Notizordner", kept: ["Nur 14 von 22 waren dabei.", "Zwei haben gefragt, ob der Kurs im Frühling weitergeht."] },
          brief: { at: "16:45", text: "22 Studierende sind eingeschrieben, letzte Woche waren 14 dabei. Zwei haben gefragt, ob der Kurs im Frühling weitergeht. Das gehört zu deiner offenen Frage, ob du ihn wieder unterrichtest.",
            src: [["Kalender", "desk-ics", "Abendkurs, wöchentlich, online."], ["Notizen", "Notizordner", "4. Nov.: 14 von 22 dabei. Zwei fragen, ob es im Frühling weitergeht."]], missing: [`Das Kursforum hat in Threva keinen Adapter, darum hat ${A} es nicht gelesen.`] } }),
      ],
      week: [
        { d: "Mi 11", today: true, ev: [["9:00", "Projekt-Stand-up"], ["12:30", "Mittagessen mit Mara"], ["14:00", "Kickoff Krisenübung"], ["17:00", "Abendkurs"]], link: [] },
        { d: "Do 12", ev: [["9:00", "Risikoanalyse, Interviews"], ["14:00", "Lenkungsausschuss Gemeindeprojekt"]], link: [["inv", "Statusbericht: Verzug hier ansprechen?"]] },
        { d: "Fr 13", ev: [["10:00", "Artikel fertig schreiben"]], link: [] },
        { d: "Sa 14", ev: [], link: [] },
        { d: "So 15", ev: [], link: [] },
        { d: "Mo 16", ev: [["10:00", "Drehbuch der Krisenübung mit Sara"]], link: [["ws", "Wie baue ich die Krisenübung auf?"]] },
        { d: "Di 17", ev: [["16:00", "Sprechstunde für Studierende"]], link: [["train", "Frühbucherpreis für die Zertifizierung endet"]] },
      ],
      dfy: [
        { id: "mail", label: "Mail aufgeräumt", n: 11, why: "Du hast solche Mails dreimal als unwichtig markiert.", items: ["9 Mails aus zwei Newsletter-Sammlungen gelöscht", "2 Anmeldebestätigungen archiviert"] },
        { id: "agent", label: "Agenten-Aufgaben wiederholt", n: 1, why: "Du hast für fehlgeschlagene Aufgaben einen zweiten Versuch erlaubt.", items: ["Der Export der Stundenliste ist um 06:10 fehlgeschlagen und hat beim zweiten Versuch geklappt"] },
        { id: "file", label: "Gedanken abgelegt", n: 2, why: "Beide passten zu einer Frage, die du schon hast.", items: ["«Parkplätze beim Kunden abklären» kam zu Krisenübung", "«Prüfungsfragen sammeln» kam zu Abendkurs"] },
        { id: "rt", label: "Routinen gelaufen", n: 12, why: "Sie sind so eingestellt, dass sie selbständig laufen.", items: ["Mail-Zusammenfassung am Morgen: in Ordnung", "Sicherheitsmeldungen: seit Mitternacht geprüft, keine betrifft deine Mandate", "Sicherung um 22:00 fehlgeschlagen; siehe Karte oben"] },
      ],
      rev: { wins: { total: 9, by: "Mandate 5 · Lehre 3 · Ich 1", top: ["Vorgespräch zur Krisenübung geführt", "Risikoanalyse für das Gemeindeprojekt abgegeben", "Vierte Kurseinheit vorbereitet und gehalten"] },
        stale: [{ id: "s1", q: "Neuer Text für die Angebotsseite", age: "seit fünf Wochen unberührt", a: null }, { id: "s2", q: "Welche drei Kunden frage ich nach einer Referenz?", age: "seit vier Wochen unberührt", a: null }],
        checks: [{ id: "c1", q: "Keine Offerte mehr ohne Vorgespräch schreiben", on: "entschieden am 2. September", expect: "Nicht weniger Aufträge im Oktober.", a: null }] },
      rt: [
        { id: "r1", name: "Morgens neue Mails aus den Mandaten zusammenfassen", when: "Jeden Werktag um 07:30", next: "morgen, 07:30", policy: "auto", recipe: "Neue Mails zusammenfassen",
          steps: [["Ungelesene Mails aus den Mandaten lesen", "Mail · desk-imap"], ["Jedes Mail in zwei Zeilen zusammenfassen", A], ["Die Zusammenfassung zuoberst in den Tag stellen", "Threva"]], runs: [["Heute, 07:30", "In Ordnung. Drei Mails zusammengefasst."], ["Gestern, 07:30", "In Ordnung. Ein Mail zusammengefasst."]] },
        { id: "r2", name: "Wochenartikel veröffentlichen", when: "Jeden Montag um 09:00", next: "wartet auf dich", policy: "ask", pending: "Die Routine will den Artikel über Passwortregeln veröffentlichen, den du am Freitag fertig geschrieben hast.",
          steps: [["Fertigen Artikel lesen", "Notizen · Notizordner"], ["Titel und Vorschautext schreiben", A], ["Artikel veröffentlichen", "Website · noch kein Adapter, per Mail an deinen Webhoster"]], runs: [["Montag, 09:00", "Wartet auf deine Freigabe."], ["2. November", "In Ordnung. Artikel veröffentlicht."]] },
        { id: "r3", name: "Notizen sichern", when: "Jeden Tag um 22:00", next: "heute, 22:00", policy: "auto", failed: "Gestern um 22:00 war der Sicherungsordner nicht erreichbar. Die Notizen sind unverändert, es ging nichts verloren.",
          steps: [["Heute geänderte Notizen sammeln", "Notizen · Notizordner"], ["In den Sicherungsordner kopieren", "Dateien · Sicherungslaufwerk"]], runs: [["Gestern, 22:00", "Fehlgeschlagen. Der Sicherungsordner war nicht erreichbar."], ["9. November, 22:00", "In Ordnung. Sechs Notizen kopiert."]] },
        { id: "r4", name: "Stunden am Freitag: Stunden pro Mandat zusammenstellen", when: "Jeden Freitag um 16:00", next: "Freitag, 16:00", policy: "auto", recipe: "Stunden pro Mandat zusammenstellen",
          steps: [["Erfasste Stunden der Woche lesen", "Zeiterfassung · noch kein Adapter, aus einer Tabelle"], ["Stunden pro Mandat zusammenzählen", A], ["Die Übersicht zuoberst in den Tag stellen", "Threva"]], runs: [["6. November, 16:00", "In Ordnung. 31 Stunden auf drei Mandate verteilt."]] },
        { id: "r5", name: "Sicherheitsmeldungen beobachten", when: "Alle 15 Minuten", next: "in ein paar Minuten", policy: "auto", background: true,
          steps: [["Meldestellen auf neue Sicherheitsmeldungen prüfen", "Web"], ["Mir nur melden, wenn eine davon meine Mandate betrifft", "Threva"]], runs: [["Heute", "42 Prüfungen, keine Meldung betrifft deine Mandate."]] },
      ],
      recipes: [["Neue Mails zusammenfassen", 3, "Morgens neue Mails aus den Mandaten zusammenfassen"], ["Stunden pro Mandat zusammenstellen", 3, "Stunden am Freitag"]],
      examples,
      guide: packGuide(A, examples, { suggestTopic: "zum Format deines Workshops", suggestCard: "zum Workshop",
        decide: "Ein Agent hat den wöchentlichen Statusbericht für das Gemeindeprojekt vorbereitet und wartet auf dich.",
        plan: "Du willst die Folien für Donnerstag heute noch exportieren.", meeting: "das Kickoff für die Krisenübung",
        area: "Mandate", proj: "Krisenübung", projIn: "bei der Krisenübung", routineWish: "jeden Montag automatisch die neuen Anfragen aufgelistet werden" }),
    };
  },

  manager: (A) => {
    const examples = { merge: "Personalabteilung nach den Rollenbeschreibungen fragen", routine: "jeden Montag die Abwesenheiten der Woche auflisten", row: "Fragen und Antworten vorbereiten" };
    return {
      areas: [{ id: "clients", label: "Team", w: 40, got: 52 }, { id: "business", label: "Projekte", w: 35, got: 40 }, { id: "me", label: "Ich", w: 25, got: 8 }],
      proj: { ws: "Reorganisation", probono: "Anfragen", rate: "Stellenplanung", inv: "Ferienplanung", train: "Weiterbildung", evening: "Teammeeting", news: "Quartals-Update" },
      est: packEst(),
      items: [
        itm("ws", "Question", "clients", true, { q: "Wie informiere ich das Team über die Reorganisation?", why: "Die Information ans Team ist in fünf Tagen.", next: "Offener Punkt vom Montag: Wer beantwortet die Fragen zu den Rollen?",
          prior: { when: "Am Montag im Gespräch geklärt", before: "Zuerst ein Mail an alle, dann Fragen im Teammeeting.", after: "Zuerst persönlich sagen, wenn alle im selben Raum sind. Das Mail kommt danach als Zusammenfassung.",
            settled: ["Zuerst persönlich sagen statt per Mail.", "Das Mail erst danach als Zusammenfassung."], open: ["Wer beantwortet die Fragen zu den Rollen, du oder die Personalabteilung?"],
            turns: [["Du", "Ich wollte zuerst ein Mail schicken, damit alle gleichzeitig dasselbe lesen. Bei diesem Thema bin ich nicht sicher, ob das gut ankommt."], [A, "Nach der letzten Umstellung haben zwei aus dem Team gesagt, sie hätten es lieber von dir gehört. Was hat ihnen gefehlt?"], ["Du", "Dass sie sofort nachfragen konnten."], [A, "Dann sag es persönlich. Wer könnte die Fragen zu den Rollen beantworten?"]] },
          read: "Lea aus der Personalabteilung hat am Freitag geschrieben, dass sie am Montag dabei sein kann. Laut deinen Notizen ändert sich für zwei Personen die Rolle, und die neuen Rollenbeschreibungen sind erst im Dezember fertig. Du hast auch notiert, dass das Team Neuigkeiten lieber von dir hört.",
          src: [["Mail von Lea, Fr", "Ich kann am Montag um 9:00 dabei sein, falls du mich brauchst."], ["deine Notizen, Gespräch mit der Bereichsleitung", "Zwei Rollen ändern sich. Rollenbeschreibungen fertig im Dezember."]],
          opts: ["Ich bitte Lea, die Fragen zu den Rollen zu beantworten.", "Ich beantworte die Fragen selbst und sage, was noch nicht feststeht."],
          counter: ["Wenn die Personalabteilung im Raum sitzt, wirkt die Information förmlicher, und manche fragen dann gar nicht.", "Die Rollenbeschreibungen sind erst im Dezember fertig. Bei den wichtigsten Fragen müsstest du sagen, dass du es noch nicht weisst."] }),
        itm("rate", "Question", "business", true, { q: "Beantrage ich eine zweite Koordinationsstelle?", why: "Die Stellenplanung für nächstes Jahr schliesst Ende Monat.", next: `${A} hat einen Vorschlag für dich.`,
          stand: "Wir kommen wohl noch ein Jahr so durch.", proposal: "Eine zweite Koordinationsstelle mit 60 Prozent beantragen, befristet auf ein Jahr.",
          read: "Tim koordiniert seit dem Frühling drei Projekte statt zwei. Seine Überstunden sind seither von 12 auf 46 gestiegen, und im Oktober haben sich zwei Projektübergaben verzögert.",
          src: [["Zeiterfassung, letzte 6 Monate", "Tim: 46 Überstunden. Im Mai waren es 12."], ["Projektliste", "Drei laufende Projekte mit Koordination. Im Frühling waren es zwei."], ["Protokolle vom Oktober", "Zwei Übergaben um je eine Woche verschoben, beide wegen fehlender Koordination."]] }),
        itm("probono", "Mail", "clients", true, { q: "Anfrage: Jonas möchte Sara für zwei Wochen ausleihen", why: "Die Anfrage ist neun Tage alt.", next: "Braucht eine Antwort. Sobald du entschieden hast, kann eine Antwort entworfen werden.",
          read: "Jonas fragt für die ersten zwei Dezemberwochen. Du hast dieses Jahr zweimal jemanden ausgeliehen und im September geschrieben, dass bis zum Jahresabschluss niemand mehr weggeht.",
          src: [["Mail von Jonas, 2. Nov.", "Uns fehlt für die Einführung jemand, der das System kennt. Zwei Wochen würden reichen."], ["deine Notiz, September", "Ausleihen: bis zum Jahresabschluss niemand mehr."]],
          opts: ["Absagen und anbieten, dass Sara an zwei halben Tagen für Fragen da ist.", "Zusagen, weil Jonas im Frühling auch ausgeholfen hat."],
          counter: ["Jonas hat dir im Frühling ohne Rückfrage jemanden für drei Wochen gegeben.", "Eine Zusage bricht die Regel, die du dir im September gesetzt hast, und Sara fehlt dir mitten im Jahresabschluss."] }),
        itm("inv", "Agent is waiting", "clients", true, { q: "Der Ferienplan hat zwei Überschneidungen. Trotzdem ans Team senden?", why: "Der Agent hat den Ferienplan zusammengestellt und sendet ihn nicht von sich aus.", next: "Er macht weiter, sobald du entschieden hast.",
          read: "In der Woche vom 21. Dezember fehlen Nico und Sara gleichzeitig, in der Woche vom 4. Januar Nico und Tim. Mit Nico hast du am Donnerstag ein Einzelgespräch.",
          src: [["Ferienplan, Entwurf", "21. bis 24. Dez.: Nico und Sara. 4. bis 8. Jan.: Nico und Tim."], ["Kalender, Donnerstag", "Einzelgespräch mit Nico um 14:00."]],
          opts: ["Den Plan so senden und das Team bitten, die zwei Überschneidungen unter sich zu lösen.", "Noch nicht senden. Ich spreche Nico am Donnerstag an, er ist in beiden Wochen betroffen."],
          counter: ["Wer sich zuerst eingetragen hat, gibt selten nach, und die Frage kommt dann später doch zu dir.", "Drei Personen warten seit letzter Woche auf den Plan, weil sie Ferien buchen wollen."] }),
        itm("train", "Question", "me", false, { suggest: true, tonight: true, q: "Soll ich den Führungslehrgang machen?", why: "Der Bereich Ich ist diese Woche zu kurz gekommen. Die Anmeldefrist läuft am Dienstag ab." }),
        itm("evening", "Question", "clients", false, { q: "Behalte ich das wöchentliche Teammeeting so bei?", why: "Im Januar beginnt der neue Sitzungsplan." }),
        itm("news", "Question", "business", false, { q: "Was kommt ins Quartals-Update?", who: "agent", doing: "Entwirft seit 09:12 drei Themenideen aus den Projektberichten des Quartals", why: "Ein Agent entwirft Ideen dazu." }),
        itm("print", "Task", "clients", true, { proj: "Mitarbeitergespräche", q: "Unterlagen für das Mitarbeitergespräch ausdrucken", why: "Fällig am Freitag.", next: "Dauert zehn Minuten und ist am Freitag fällig." }),
        itm("room", "Task", "business", false, { proj: "Budget", q: "Budget für nächstes Jahr einreichen", why: "Fällig am 30. November." }),
        itm("walk", "Task", "me", false, { proj: "Gesundheit", q: "Termin beim Optiker buchen", why: "Ohne Datum." }),
      ],
      day: [
        mtg("m1", "Einzelgespräch mit Sara", { area: "clients", with: "Sara, monatliches Einzelgespräch", where: "Sitzungszimmer 3" }),
        mtg("m2", "Mittagessen mit Mara", { area: "me", with: "Mara", where: "Kantine" }),
        mtg("m3", "Lenkungsausschuss", { area: "business", with: "Bereichsleitung und vier Projektleitende", where: "Sitzungszimmer im 4. Stock", notes: ["Fragen, wann das Budget für das Kundenportal kommt"],
          last: { when: "Letzte Sitzung, 14. Oktober", from: "Notizordner", kept: ["Das Budget für das Kundenportal wurde um zwei Monate verschoben.", "Die Bereichsleitung will Zahlen zur Auslastung sehen."] },
          brief: { at: "13:45", text: "Das ist der dritte Lenkungsausschuss in diesem Jahr. Letztes Mal wurde das Budget für das Kundenportal um zwei Monate verschoben, und die Bereichsleitung wollte Zahlen zur Auslastung sehen. Jonas hat am 1. November geschrieben, dass er über die Koordination zwischen den Teams sprechen möchte. Das steht noch nicht auf der Traktandenliste.",
            src: [["Kalender", "desk-ics", "Lenkungsausschuss, 14:00 bis 15:30, Sitzungszimmer im 4. Stock."], ["Notizen", "Notizordner", "14. Okt.: Budget Kundenportal um zwei Monate verschoben. Bereichsleitung will Zahlen zur Auslastung."], ["Mail", "desk-imap", "1. Nov.: Können wir im Ausschuss über die Koordination zwischen den Teams reden?"]], missing: [] } }),
        mtg("m4", "Teammeeting", { area: "clients", with: "Acht Personen", where: "Online", join: true, raise: ["evening"],
          last: { when: "4. November", from: "Notizordner", kept: ["Zwei Personen haben gesagt, dass eine Stunde zu lang ist."] },
          brief: { at: "16:45", text: "Alle acht haben zugesagt. Letzte Woche haben zwei gesagt, dass eine Stunde zu lang ist. Das gehört zu deiner offenen Frage, ob du das Teammeeting so beibehältst.",
            src: [["Kalender", "desk-ics", "Teammeeting, wöchentlich, online."], ["Notizen", "Notizordner", "4. Nov.: Zwei Personen finden eine Stunde zu lang."]], missing: [`Der Teamchat hat in Threva keinen Adapter, darum hat ${A} ihn nicht gelesen.`] } }),
      ],
      week: [
        { d: "Mi 11", today: true, ev: [["9:00", "Einzelgespräch mit Sara"], ["12:30", "Mittagessen mit Mara"], ["14:00", "Lenkungsausschuss"], ["17:00", "Teammeeting"]], link: [] },
        { d: "Do 12", ev: [["9:00", "Projektplanung"], ["14:00", "Einzelgespräch mit Nico"]], link: [["inv", "Ferienplan: Überschneidungen hier ansprechen?"]] },
        { d: "Fr 13", ev: [["10:00", "Mitarbeitergespräch mit Tim"]], link: [] },
        { d: "Sa 14", ev: [], link: [] },
        { d: "So 15", ev: [], link: [] },
        { d: "Mo 16", ev: [["8:45", "Lea, kurze Abstimmung"], ["9:00", "Information zur Reorganisation, ganzes Team"]], link: [["ws", "Wie sage ich es dem Team?"]] },
        { d: "Di 17", ev: [["16:00", "Bereichssitzung"]], link: [["train", "Anmeldefrist für den Führungslehrgang endet"]] },
      ],
      dfy: [
        { id: "mail", label: "Mail aufgeräumt", n: 11, why: "Du hast solche Mails dreimal als unwichtig markiert.", items: ["9 Mails aus zwei Newsletter-Sammlungen gelöscht", "2 Terminzusagen archiviert"] },
        { id: "agent", label: "Agenten-Aufgaben wiederholt", n: 1, why: "Du hast für fehlgeschlagene Aufgaben einen zweiten Versuch erlaubt.", items: ["Der Export aus der Zeiterfassung ist um 06:10 fehlgeschlagen und hat beim zweiten Versuch geklappt"] },
        { id: "file", label: "Gedanken abgelegt", n: 2, why: "Beide passten zu einer Frage, die du schon hast.", items: ["«Sitzungszimmer für Montag buchen» kam zu Reorganisation", "«Zahlen zur Auslastung heraussuchen» kam zu Stellenplanung"] },
        { id: "rt", label: "Routinen gelaufen", n: 12, why: "Sie sind so eingestellt, dass sie selbständig laufen.", items: ["Mail-Zusammenfassung am Morgen: in Ordnung", "Ticket-Warteschlange: seit Mitternacht geprüft, kein Ticket wartet zu lange", "Sicherung um 22:00 fehlgeschlagen; siehe Karte oben"] },
      ],
      rev: { wins: { total: 9, by: "Team 5 · Projekte 3 · Ich 1", top: ["Alle Einzelgespräche für Oktober geführt", "Projektplan für das Kundenportal abgegeben", "Spesen für September freigegeben"] },
        stale: [{ id: "s1", q: "Neue Checkliste für die Einarbeitung", age: "seit fünf Wochen unberührt", a: null }, { id: "s2", q: "Wen schlage ich als Stellvertretung vor?", age: "seit vier Wochen unberührt", a: null }],
        checks: [{ id: "c1", q: "Keine Sitzungen mehr am Freitagnachmittag", on: "entschieden am 2. September", expect: "Nicht mehr offene Punkte am Montag als vorher.", a: null }] },
      rt: [
        { id: "r1", name: "Morgens neue Mails aus dem Team zusammenfassen", when: "Jeden Werktag um 07:30", next: "morgen, 07:30", policy: "auto", recipe: "Neue Mails zusammenfassen",
          steps: [["Ungelesene Mails aus dem Team lesen", "Mail · desk-imap"], ["Jedes Mail in zwei Zeilen zusammenfassen", A], ["Die Zusammenfassung zuoberst in den Tag stellen", "Threva"]], runs: [["Heute, 07:30", "In Ordnung. Drei Mails zusammengefasst."], ["Gestern, 07:30", "In Ordnung. Ein Mail zusammengefasst."]] },
        { id: "r2", name: "Wochen-Update ans Team senden", when: "Jeden Montag um 09:00", next: "wartet auf dich", policy: "ask", pending: "Die Routine will das Update mit den zwei Terminen senden, die du letzte Woche bestätigt hast.",
          steps: [["Beschlüsse und Termine der Woche lesen", "Notizen · Notizordner"], ["Update schreiben", A], ["An das Team senden", "Mail · desk-imap"]], runs: [["Montag, 09:00", "Wartet auf deine Freigabe."], ["2. November", "In Ordnung. Update gesendet."]] },
        { id: "r3", name: "Sitzungsnotizen sichern", when: "Jeden Tag um 22:00", next: "heute, 22:00", policy: "auto", failed: "Gestern um 22:00 war der Sicherungsordner nicht erreichbar. Die Notizen sind unverändert, es ging nichts verloren.",
          steps: [["Heute geänderte Notizen sammeln", "Notizen · Notizordner"], ["In den Sicherungsordner kopieren", "Dateien · Sicherungslaufwerk"]], runs: [["Gestern, 22:00", "Fehlgeschlagen. Der Sicherungsordner war nicht erreichbar."], ["9. November, 22:00", "In Ordnung. Fünf Notizen kopiert."]] },
        { id: "r4", name: "Freigaben am Freitag: offene Freigaben auflisten", when: "Jeden Freitag um 16:00", next: "Freitag, 16:00", policy: "auto", recipe: "Offene Freigaben auflisten",
          steps: [["Offene Anträge lesen", "Personalsystem · noch kein Adapter, aus einer Tabelle"], ["Alle auflisten, die länger als fünf Tage warten", A], ["Die Liste zuoberst in den Tag stellen", "Threva"]], runs: [["6. November, 16:00", "In Ordnung. Vier Freigaben aufgelistet."]] },
        { id: "r5", name: "Ticket-Warteschlange beobachten", when: "Alle 15 Minuten", next: "in ein paar Minuten", policy: "auto", background: true,
          steps: [["Warteschlange auf Tickets prüfen, die länger als zwei Tage warten", "Tickets"], ["Mir nur melden, wenn es eines gibt", "Threva"]], runs: [["Heute", "42 Prüfungen, kein Ticket wartet zu lange."]] },
      ],
      recipes: [["Neue Mails zusammenfassen", 3, "Morgens neue Mails aus dem Team zusammenfassen"], ["Offene Freigaben auflisten", 3, "Freigaben am Freitag"]],
      examples,
      guide: packGuide(A, examples, { suggestTopic: "zur zweiten Koordinationsstelle", suggestCard: "zur Koordinationsstelle",
        decide: "Ein Agent hat den Ferienplan zusammengestellt, zwei Überschneidungen gefunden und wartet auf dich.",
        plan: "Du willst die Unterlagen für das Mitarbeitergespräch heute noch ausdrucken.", meeting: "den Lenkungsausschuss",
        area: "Team", proj: "Reorganisation", projIn: "bei der Reorganisation", routineWish: "jeden Montag automatisch die Abwesenheiten der Woche aufgelistet werden" }),
    };
  },

  dev: (A) => {
    const examples = { merge: "Nico nach der Testumgebung für den Rollback fragen", routine: "jeden Montag die offenen Pull Requests auflisten", row: "Testdaten vorbereiten" };
    return {
      areas: [{ id: "clients", label: "Produkt", w: 50, got: 63 }, { id: "business", label: "Betrieb", w: 25, got: 28 }, { id: "me", label: "Ich", w: 25, got: 9 }],
      proj: { ws: "Datenbankmigration", probono: "Externe Beiträge", rate: "Tests und CI", inv: "Tests und CI", train: "Weiterbildung", evening: "Pikett", news: "Technische Schulden" },
      est: packEst(),
      items: [
        itm("ws", "Question", "clients", true, { q: "Wie teile ich die Migration der Datenbank auf?", why: "Der erste Schritt der Migration ist in fünf Tagen.", next: "Offener Punkt vom Montag: Wer testet den Rollback?",
          prior: { when: "Am Montag im Gespräch geklärt", before: "Alles in einem Schritt umstellen, an einem Wochenende.", after: "Zuerst nur die Lesezugriffe umstellen. Die Schreibzugriffe folgen nach dem Release.",
            settled: ["Zuerst nur die Lesezugriffe statt alles auf einmal.", "Die Schreibzugriffe erst nach dem Release."], open: ["Wer testet den Rollback, du oder Nico?"],
            turns: [["Du", "Ich wollte alles an einem Wochenende umstellen. Bei dieser Datenmenge bin ich nicht sicher, ob das gut geht."], [A, "In deinem Rückblick steht, dass die grosse Umstellung im Frühling zwei Tage Ausfall gebracht hat. Was würdest du heute anders machen?"], ["Du", "Kleinere Schritte, die sich einzeln zurücknehmen lassen."], [A, "Dann fang mit den Lesezugriffen an. Wer könnte den Rollback testen?"]] },
          read: "Nico hat am Freitag geschrieben, dass die Testumgebung ab Donnerstag frei ist. In deinen Notizen steht, dass die Lesezugriffe 80 Prozent der Last ausmachen und der Rollback noch nie mit echten Datenmengen getestet wurde. Das Team will kleine Schritte, die sich einzeln zurücknehmen lassen.",
          src: [["Mail von Nico, Fr", "Die Testumgebung ist ab Donnerstag frei. Ich brauche sie erst am Dienstag wieder."], ["deine Notizen, Rückblick Frühling", "Grosse Umstellung: zwei Tage Ausfall. Rollback nie mit echten Datenmengen getestet."]],
          opts: ["Ich bitte Nico, den Rollback zu testen.", "Ich teste den Rollback selbst, bevor es losgeht."],
          counter: ["Nico hat die Migration nicht geschrieben und müsste sich zuerst einlesen. Die Testumgebung ist nur bis Dienstag frei.", "Du hast die Migration geschrieben und testest vor allem die Fälle, an die du schon gedacht hast."] }),
        itm("rate", "Question", "business", true, { q: "Wechseln wir das Testframework jetzt oder nach dem Release?", why: "Der Release ist in zwei Wochen.", next: `${A} hat einen Vorschlag für dich.`,
          stand: "Ich warte wohl besser bis nach dem Release.", proposal: "Jetzt nur die langsamen Integrationstests umziehen. Der Rest folgt nach dem Release.",
          read: "Ein Testlauf dauert im Schnitt 24 Minuten, im Juli waren es 11. Von 38 fehlgeschlagenen Läufen in den letzten 30 Tagen liefen 31 beim zweiten Versuch durch, fast immer wegen eines Integrationstests.",
          src: [["CI, letzte 30 Tage", "212 Läufe, im Schnitt 24 Minuten. 38 fehlgeschlagen, 31 davon beim zweiten Versuch in Ordnung."], ["CI, Juli", "Im Schnitt 11 Minuten pro Lauf."], ["Liste der unzuverlässigen Tests", "17 Tests, 15 davon Integrationstests."]] }),
        itm("probono", "Mail", "clients", true, { q: "Anfrage: einen externen Pull Request durchsehen", why: "Die Anfrage ist neun Tage alt.", next: "Braucht eine Antwort. Sobald du entschieden hast, kann eine Antwort entworfen werden.",
          read: "Eine Kundenfirma hat einen Pull Request für den CSV-Export geschickt, rund 900 Zeilen. Du hast dieses Jahr zwei externe Beiträge durchgesehen und im September geschrieben, dass vor dem Release keiner mehr dazukommt.",
          src: [["Mail zum Pull Request, 2. Nov.", "Wir brauchen den Export als CSV und haben ihn gleich selbst gebaut. Könnt ihr das übernehmen?"], ["deine Notiz, September", "Externe Beiträge: vor dem Release keine mehr."]],
          opts: ["Absagen bis nach dem Release und einen Termin dafür nennen.", "Jetzt durchsehen, weil auch andere Kunden nach dem Export gefragt haben."],
          counter: ["Drei Kunden haben nach diesem Export gefragt, und hier ist er schon gebaut.", "Eine Zusage bricht die Regel, die du dir im September gesetzt hast, und 900 Zeilen kosten dich etwa einen halben Tag."] }),
        itm("inv", "Agent is waiting", "business", true, { q: "Der Build schlägt fehl. Den vorbereiteten Fix mergen?", why: "Der Agent hat einen Fix vorbereitet und mergt ihn nicht von sich aus.", next: "Er macht weiter, sobald du entschieden hast.",
          read: "Der Build schlägt seit gestern Abend fehl, weil die PDF-Bibliothek eine neue Version bekommen hat. Der Fix legt die alte Version fest. Am Donnerstag gehst du mit Tim die Abhängigkeiten durch.",
          src: [["CI, letzter Lauf", "Fehlgeschlagen seit gestern, 18:40. Ursache: neue Version der PDF-Bibliothek."], ["Kalender, Donnerstag", "Abhängigkeiten durchgehen mit Tim um 14:00."]],
          opts: ["Den Fix mergen. Die alte Version bleibt festgelegt, der Build läuft wieder.", "Nicht mergen. Ich stelle am Donnerstag mit Tim richtig auf die neue Version um."],
          counter: ["Die letzte festgelegte alte Version habt ihr acht Monate lang nicht angefasst.", "Bis Donnerstag kann niemand im Team etwas ausliefern, und der Release ist in zwei Wochen."] }),
        itm("train", "Question", "me", false, { suggest: true, tonight: true, q: "Soll ich die neue Programmiersprache richtig lernen?", why: "Der Bereich Ich ist diese Woche zu kurz gekommen. Der Frühbucherpreis für den Kurs gilt bis Dienstag." }),
        itm("evening", "Question", "business", false, { q: "Machen wir den Pikettdienst weiter wie bisher?", why: "Der neue Pikettplan beginnt im Januar." }),
        itm("news", "Question", "business", false, { q: "Was kommt auf die Liste der technischen Schulden?", who: "agent", doing: "Entwirft seit 09:12 drei Vorschläge aus den Störungen des letzten Quartals", why: "Ein Agent entwirft Ideen dazu." }),
        itm("print", "Task", "clients", true, { proj: "Release", q: "Changelog für den Release schreiben", why: "Fällig am Freitag.", next: "Dauert zehn Minuten und ist am Freitag fällig." }),
        itm("room", "Task", "business", false, { proj: "Infrastruktur", q: "Zertifikat der Testumgebung erneuern", why: "Fällig am 30. November." }),
        itm("walk", "Task", "me", false, { proj: "Privat", q: "Velo in den Service bringen", why: "Ohne Datum." }),
      ],
      day: [
        mtg("m1", "Stand-up und Planung", { area: "clients", with: "Nico, Tim und Lea", where: "Teamraum" }),
        mtg("m2", "Mittagessen mit Mara", { area: "me", with: "Mara", where: "Mensa nebenan" }),
        mtg("m3", "Architektur-Review", { area: "clients", with: "Tim und Lea, zum Entwurf der Migration", where: "Sitzungszimmer 2", notes: ["Fragen, ob die Lesekopie in der Testumgebung schon läuft"],
          last: { when: "Erstes Review, 28. Oktober", from: "Notizordner", kept: ["Die Lesezugriffe laufen über eine eigene Lesekopie.", "Lea war skeptisch wegen der Verzögerung der Kopie. Zuerst bei Lea nachfragen."] },
          brief: { at: "13:45", text: "Das ist das zweite Review zur Migration. Im Entwurf laufen die Lesezugriffe seit dem 28. Oktober über eine eigene Lesekopie. In deinen Notizen steht, dass Lea wegen der Verzögerung skeptisch war. Tim hat am 1. November geschrieben, dass er über die Sicherung während der Migration sprechen möchte. Das war noch in keinem Review Thema.",
            src: [["Code", "Git-Adapter", "Entwurf der Migration: drei Änderungen seit dem 28. Okt., Lesekopie eingerichtet."], ["Notizen", "Notizordner", "28. Okt.: Lesezugriffe über eigene Lesekopie. Lea skeptisch wegen Verzögerung."], ["Mail", "desk-imap", "1. Nov.: Können wir im Review über die Sicherung während der Migration reden?"]], missing: [] } }),
        mtg("m4", "Pikett-Übergabe", { area: "business", with: "Nico übergibt an dich", where: "Online", join: true, raise: ["evening"],
          last: { when: "4. November", from: "Notizordner", kept: ["Zwei Alarme in der Nacht, beide ohne echte Störung."] },
          brief: { at: "16:45", text: "Nico übergibt dir den Pikettdienst für eine Woche. Letzte Woche gab es zwei Alarme in der Nacht, beide ohne echte Störung. Das gehört zu deiner offenen Frage, ob ihr den Pikettdienst weiter so macht.",
            src: [["Kalender", "desk-ics", "Pikett-Übergabe, wöchentlich, online."], ["Notizen", "Notizordner", "4. Nov.: Zwei Alarme in der Nacht, beide ohne echte Störung."]], missing: [`Die Tickets haben in Threva keinen Adapter, darum hat ${A} die offenen Störungen nicht gelesen.`] } }),
      ],
      week: [
        { d: "Mi 11", today: true, ev: [["9:00", "Stand-up und Planung"], ["12:30", "Mittagessen mit Mara"], ["14:00", "Architektur-Review"], ["17:00", "Pikett-Übergabe"]], link: [] },
        { d: "Do 12", ev: [["9:00", "Stand-up"], ["14:00", "Abhängigkeiten durchgehen mit Tim"]], link: [["inv", "Fehlgeschlagener Build: hier richtig lösen?"]] },
        { d: "Fr 13", ev: [["9:00", "Stand-up"], ["10:00", "Demo für das Produktteam"]], link: [] },
        { d: "Sa 14", ev: [], link: [] },
        { d: "So 15", ev: [], link: [] },
        { d: "Mo 16", ev: [["9:00", "Stand-up"], ["10:00", "Migration, erster Schritt"]], link: [["ws", "Wie teile ich die Migration auf?"]] },
        { d: "Di 17", ev: [["9:00", "Stand-up"], ["16:00", "Rückblick auf den Sprint"]], link: [["train", "Frühbucherpreis für den Kurs endet"]] },
      ],
      dfy: [
        { id: "mail", label: "Mail aufgeräumt", n: 11, why: "Du hast solche Mails dreimal als unwichtig markiert.", items: ["9 automatische Benachrichtigungen aus zwei Systemen gelöscht", "2 Terminzusagen archiviert"] },
        { id: "agent", label: "Agenten-Aufgaben wiederholt", n: 1, why: "Du hast für fehlgeschlagene Aufgaben einen zweiten Versuch erlaubt.", items: ["Der nächtliche Testlauf ist um 06:10 fehlgeschlagen und hat beim zweiten Versuch geklappt"] },
        { id: "file", label: "Gedanken abgelegt", n: 2, why: "Beide passten zu einer Frage, die du schon hast.", items: ["«Indexe vor der Migration prüfen» kam zu Datenbankmigration", "«Laufzeit der Tests messen» kam zu Tests und CI"] },
        { id: "rt", label: "Routinen gelaufen", n: 12, why: "Sie sind so eingestellt, dass sie selbständig laufen.", items: ["Zusammenfassung der Review-Anfragen am Morgen: in Ordnung", "Fehlerrate: seit Mitternacht geprüft, immer unter 1 Prozent", "Sicherung um 22:00 fehlgeschlagen; siehe Karte oben"] },
      ],
      rev: { wins: { total: 9, by: "Produkt 5 · Betrieb 3 · Ich 1", top: ["Entwurf der Migration im ersten Review gezeigt", "Suchfilter für zwei Kunden ausgeliefert", "Pikettwoche ohne Ausfall abgeschlossen"] },
        stale: [{ id: "s1", q: "Neue Anleitung für die Entwicklungsumgebung", age: "seit fünf Wochen unberührt", a: null }, { id: "s2", q: "Welche drei alten Schnittstellen schalten wir ab?", age: "seit vier Wochen unberührt", a: null }],
        checks: [{ id: "c1", q: "Am Freitag nichts mehr ausliefern", on: "entschieden am 2. September", expect: "Weniger Störungen am Wochenende im Oktober.", a: null }] },
      rt: [
        { id: "r1", name: "Morgens neue Review-Anfragen zusammenfassen", when: "Jeden Werktag um 07:30", next: "morgen, 07:30", policy: "auto", recipe: "Review-Anfragen zusammenfassen",
          steps: [["Offene Review-Anfragen lesen", "Code · Git-Adapter"], ["Jede Anfrage in zwei Zeilen zusammenfassen", A], ["Die Zusammenfassung zuoberst in den Tag stellen", "Threva"]], runs: [["Heute, 07:30", "In Ordnung. Drei Anfragen zusammengefasst."], ["Gestern, 07:30", "In Ordnung. Eine Anfrage zusammengefasst."]] },
        { id: "r2", name: "Release Notes veröffentlichen", when: "Jeden Montag um 09:00", next: "wartet auf dich", policy: "ask", pending: "Die Routine will die Release Notes mit den zwei Änderungen veröffentlichen, die du am Freitag freigegeben hast.",
          steps: [["Änderungen seit dem letzten Release lesen", "Code · Git-Adapter"], ["Release Notes schreiben", A], ["Auf der Hilfeseite veröffentlichen", "Website · noch kein Adapter, per Mail an das Support-Team"]], runs: [["Montag, 09:00", "Wartet auf deine Freigabe."], ["2. November", "In Ordnung. Release Notes veröffentlicht."]] },
        { id: "r3", name: "Datenbank jede Nacht sichern", when: "Jeden Tag um 22:00", next: "heute, 22:00", policy: "auto", failed: "Gestern um 22:00 war der Sicherungsspeicher nicht erreichbar. Die Sicherung vom Vortag ist vollständig, es ging nichts verloren.",
          steps: [["Abbild der Datenbank erstellen", "Datenbank · Sicherungs-Adapter"], ["In den Sicherungsspeicher kopieren", "Dateien · Sicherungslaufwerk"]], runs: [["Gestern, 22:00", "Fehlgeschlagen. Der Sicherungsspeicher war nicht erreichbar."], ["9. November, 22:00", "In Ordnung. Abbild mit 14 GB kopiert."]] },
        { id: "r4", name: "Tests am Freitag: unzuverlässige Tests auflisten", when: "Jeden Freitag um 16:00", next: "Freitag, 16:00", policy: "auto", recipe: "Unzuverlässige Tests auflisten",
          steps: [["Testläufe der Woche lesen", "CI · Build-Adapter"], ["Alle Tests auflisten, die erst beim zweiten Versuch durchliefen", A], ["Die Liste ans Team schicken", "Tickets · kein Adapter, per Mail"]], runs: [["6. November, 16:00", "In Ordnung. 17 Tests aufgelistet."]] },
        { id: "r5", name: "Fehlerrate beobachten", when: "Alle 15 Minuten", next: "in ein paar Minuten", policy: "auto", background: true,
          steps: [["Fehlerrate der Anwendung prüfen", "Überwachung"], ["Mir nur melden, wenn sie über 2 Prozent steigt", "Threva"]], runs: [["Heute", "42 Prüfungen, Fehlerrate immer unter 1 Prozent."]] },
      ],
      recipes: [["Review-Anfragen zusammenfassen", 3, "Morgens neue Review-Anfragen zusammenfassen"], ["Unzuverlässige Tests auflisten", 3, "Tests am Freitag"]],
      examples,
      guide: packGuide(A, examples, { suggestTopic: "zum Wechsel des Testframeworks", suggestCard: "zum Testframework",
        decide: "Ein Agent hat einen Fix für den fehlgeschlagenen Build vorbereitet und wartet auf dich.",
        plan: "Du willst den Changelog für den Release heute noch schreiben.", meeting: "das Architektur-Review",
        area: "Produkt", proj: "Datenbankmigration", projIn: "bei der Datenbankmigration", routineWish: "jeden Montag automatisch die offenen Pull Requests aufgelistet werden" }),
    };
  },
};

let SCN = "coach";
let PACK = null;
/* Builds the pack with the current assistant name and resets all state from it. Safe to call again at any time. */
function loadScenario(key) {
  SCN = key;
  PACK = SCENARIOS[key](A_NAME);
  const P = PACK;
  CAL = { now: 10 * 60 + 40, label: "Mittwoch, 11. November", day: P.day, est: P.est, week: P.week };
  U_PROJ = P.proj;
  U = { open: "rate", view: "day", focus: "all", plan: { rate: 0, probono: 0, ws: 2 }, st: {}, log: [], copied: false, toast: "", more: null, keys: false, merge: null,
    items: P.items, areas: P.areas, at: null, nodes: [], rowMenu: null, treeMore: false,
    dfy: { open: false, show: null, card: true, groups: P.dfy },
    rev: { seen: false, closed: false, card: true, area: {}, wins: P.rev.wins, stale: P.rev.stale, checks: P.rev.checks },
    ev: null, afterDone: {}, soonDone: {}, evSrc: null, briefOpen: {},
    newAll: false, rtOpen: null, rtDraft: null, rt: P.rt, recipes: P.recipes };
  for (const id of ["inv", "rate"]) U.items.find((x) => x.id === id).fresh = true;
  for (const ar of U.areas) U.nodes.push({ id: "a-" + ar.id, parent: null, title: ar.label, area: ar.id });
  for (const x of U.items) {
    const p = U_PROJ[x.id] || x.proj, pid = "p-" + x.area + "-" + p;
    if (!U.nodes.some((n) => n.id === pid)) U.nodes.push({ id: pid, parent: "a-" + x.area, title: p, w: 50 });
    U.nodes.push({ id: x.id, parent: pid, item: true, w: 50 });
  }
  Object.defineProperty(U, "after", {
    get: () => { const e = CAL.day.filter((ev) => ev.e <= CAL.now && CAL.now - ev.e <= 30 && !U.afterDone[ev.id]).pop(); return e ? e.id : null; },
    set: (v) => { if (v === null && U.after) U.afterDone[U.after] = true; },
  });
}
loadScenario("coach");
