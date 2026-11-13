const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
/* ---------- shared: how a talked-through conversation lands (F7) ---------- */
function summaryCard(p) {
  const ul = (a) => `<ul>${a.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
  return `<div class="sum">
    <span class="eyebrow">${esc(p.when)} · ${p.turns.length} exchanges</span>
    ${p.before ? `<div class="diff"><span class="faint">Where you stood, before and after</span><del>${esc(p.before)}</del><ins>${esc(p.after)}</ins></div>` : ""}
    <div class="cols"><div><b>Settled</b>${ul(p.settled)}</div><div><b>Still open</b>${p.open.length ? ul(p.open) : `<p class="muted">Nothing.</p>`}</div></div>
    <details><summary>Read the whole conversation</summary><div class="turns">${p.turns.map(([w, t]) => `<div class="turn ${w === "You" ? "me" : ""}"><b>${esc(w)}</b><p>${esc(t)}</p></div>`).join("")}</div></details>
  </div>`;
}

const NUM = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const num = (n) => NUM[n] || String(n);
let T_NAME = "";
let A_NAME = "Mira";
const KIND = { Question: "Question", Task: "Task", Mail: "Mail", "Agent is waiting": "Agent is waiting" };
const kindL = (k) => KIND[k] || k;
const V_STOP = new Set(["about", "should", "which", "again", "their", "there", "would", "could", "three", "offer", "raise", "takes", "where", "these", "those", "other", "after", "before", "first", "today", "tomorrow", "every", "while", "still", "think", "maybe", "might", "being", "since", "until", "check", "thing", "things", "something", "anything", "nothing", "someone", "because", "through", "between", "without", "right", "never", "always", "people", "please", "really", "going"]);
const vWords = (s) => s.toLowerCase().match(/[a-z]{5,}/g)?.filter((w) => !V_STOP.has(w)) || [];
/* ---------- One Studio: Vera's view with Luca's panel and Nora's replies folded in ---------- */
/* State. loadScenario() at the end of the file fills all three from the chosen scenario pack. */
let U = {}, CAL = {}, U_PROJ = {};
const ust = (id) => (U.st[id] ||= { pick: null, own: "", challenged: false, flagged: {}, openSrc: null, reply: false });
function uPanel(it) {
  const s = ust(it.id), nFlag = Object.keys(s.flagged).length;
  const srcs = it.src ? `<p>${esc(it.read)}</p>
    <div class="row">${it.src.map(([n], i) => `<button class="src${s.flagged[i] ? " flag" : ""}" data-u="src" data-i="${i}" aria-expanded="${s.openSrc === i}">${esc(n)}</button>`).join("")}</div>
    ${s.openSrc !== null ? `<div class="excerpt"><p>${esc(it.src[s.openSrc][1])}</p>${s.flagged[s.openSrc] ? `<span class="pill wait">You flagged this</span>` : `<button class="btn" data-u="flag">This is wrong or out of date</button>`}</div>` : ""}
    ${nFlag ? `<p class="faint">Flagged sources are left out and named in today's log.</p>` : ""}` : "";
  let call;
  if (it.proposal) {
    call = `<div class="ivy"><span class="from">${esc(A_NAME)} suggests you now stand here</span><p>${esc(it.proposal)}</p><p class="faint">Until now: ${esc(it.stand)}</p>
      ${s.reply ? `<label for="u-reply">What is off?<textarea id="u-reply" placeholder="Say it in your own words. ${esc(A_NAME)} picks it up tonight."></textarea></label><div class="row"><button class="btn pri" data-u="send">Send</button><button class="btn quiet" data-u="cancel">Cancel</button></div>`
        : `<div class="row"><button class="btn pri" data-u="yes">Yes, that is where I stand</button><button class="btn" data-u="notquite">Not quite</button></div>`}</div>`;
  } else if (it.opts) {
    call = `<div class="stack" role="radiogroup" aria-label="Your call"><span class="eyebrow">Your call</span>
        ${it.opts.map((o, i) => `<label class="opt"><input type="radio" name="u-opt" id="u-opt-${it.id}-${i}" value="${i}" ${s.pick === i ? "checked" : ""}><span>${esc(o)}</span></label>`).join("")}
        <label class="opt"><input type="radio" name="u-opt" id="u-opt-${it.id}-x" value="2" ${s.pick === 2 ? "checked" : ""}><span>Something else</span></label>
        ${s.pick === 2 ? `<input type="text" id="u-own" aria-label="Your own call" placeholder="Your call, in one sentence" value="${esc(s.own)}">` : ""}</div>
      ${s.challenged && s.pick !== null ? `<div class="ivy"><span class="from">The case against your call</span><p>${esc(s.pick < 2 ? it.counter[s.pick] : "I have no counter-argument for a call I did not propose.")}</p></div>` : ""}
      ${it.kind === "Question" ? `<details><summary>Check on it later (optional)</summary><div class="stack" style="margin-top:8px"><label for="u-expect-${it.id}">How will you know it was right?<input type="text" id="u-expect-${it.id}" placeholder="The sign you would see"></label><label for="u-date-${it.id}">Remind me on<input type="date" id="u-date-${it.id}" value="2027-02-15"></label></div></details>` : ""}
      <div class="row"><button class="btn pri" data-u="decide" ${s.pick === null ? "disabled" : ""}>${it.kind === "Agent is waiting" ? "Decide and tell the agent" : it.kind === "Mail" ? "Decide and draft the reply" : "I have decided"}</button><button class="btn" data-u="challenge" ${s.pick === null || s.challenged ? "disabled" : ""}>Challenge my call first</button><button class="btn quiet" data-u="talk">Talk it through instead</button></div>`;
  } else {
    call = `<div><span class="eyebrow">Where you stand</span><p>${esc(it.stand)}</p></div><div class="row"><button class="btn pri" data-u="close">I have decided</button><button class="btn quiet" data-u="talk">Talk it through</button></div>`;
  }
  return `<div class="exp" style="padding:14px 16px;border:0;border-radius:8px">${it.prior ? summaryCard(it.prior) : ""}${srcs}${call}</div>`;
}
const hm = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
const dur = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`);
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
    const evRow = `<div class="slot ev${ev.e <= CAL.now && U.ev !== ev.id ? " past" : ""}"><span class="tm">${hm(ev.s)}</span><span><button class="evb" data-u="ev" data-to="${ev.id}" aria-expanded="${U.ev === ev.id}"><b>${esc(ev.t)}</b> <span class="faint">until ${hm(ev.e)}${nRaise && ev.e > CAL.now ? ` · ${nRaise} to raise` : ""}</span></button></span>${U.ev === ev.id ? evDetail(ev) : ""}</div>`;
    if (!g) return evRow;
    const chips = g.ids.map((id) => { const x = U.items.find((y) => y.id === id); return `<div class="chip${U.focus === "all" || x.area === U.focus ? "" : " off"}"><button class="linkq" data-u="jump" data-id="${id}">${esc(x.q)}</button><span class="faint">${dur(est(id))}</span>
      ${gaps[i + 1] ? `<button class="x" data-u="later" data-id="${id}" title="Move to the next free time">Later</button>` : ""}<button class="x" data-u="unplan" data-id="${id}" aria-label="Take off the day">×</button></div>`; }).join("");
    return evRow + `<div class="slot free${g.cur ? " cur" : ""}${g.past ? " past" : ""}"><span class="tm">${hm(g.start)}</span><div>
      <span class="row">${g.cur ? `<span class="pill think">Now</span>` : ""}<span class="faint">${g.past ? `Passed${g.ids.length ? ` · ${g.ids.length} not done, press Later to move` : ""}` : `Free until ${hm(g.end)} · ${g.left >= 0 ? `${dur(g.left)} left` : ""}`}</span>${g.left < 0 && !g.past ? `<span class="pill wait">over by ${dur(-g.left)}</span>` : ""}</span>${chips}</div></div>`;
  }).join("");
  return `<div class="rail"><span class="eyebrow">${CAL.label}</span>${rows}${railRoutines()}</div>`;
}
function weekGrid() {
  const planned = Object.keys(U.plan).filter((id) => U.items.some((x) => x.id === id && x.now)).length;
  return `<div class="tw"><div class="week">${CAL.week.map((d) => `<div class="wd${d.today ? " today" : ""}"><b>${d.d}${d.today ? " · today" : ""}</b>
      ${d.ev.map(([t, n]) => `<span><span class="tm">${t}</span> ${esc(n)}</span>`).join("") || `<span class="faint">Nothing booked</span>`}
      ${d.today && planned ? `<span class="faint">${planned} planned from your list</span>` : ""}
      ${d.link.filter(([id]) => U.items.some((x) => x.id === id)).map(([id, l]) => `<button class="lk" data-u="jump" data-id="${id}">${esc(l)}</button>`).join("")}</div>`).join("")}</div></div>
    <p class="faint">Amber marks are questions from your list that belong to that day. Click one to open it.</p>`;
}
/* The Balance outline as the third view: drill in, one level at a time, framed by the ancestors. */
const nItem = (n) => U.items.find((x) => x.id === n.id);
const nKids = (id) => U.nodes.filter((n) => n.parent === id && (!n.item || nItem(n) || U.nodes.some((c) => c.parent === n.id)));
const nOpen = (id) => nKids(id).reduce((sum, n) => sum + (n.item && nItem(n) ? 1 : 0) + nOpen(n.id), 0);
const nTitle = (n) => (n.item && nItem(n) ? nItem(n).q : n.title || "Done");
const nArea = (n) => { let c = n; while (c.parent) c = U.nodes.find((m) => m.id === c.parent); return U.areas.find((a) => a.id === c.area); };
const areaState = (ar) => { const tot = U.areas.reduce((s, a) => s + a.w, 0) || 1, want = Math.round((ar.w / tot) * 100);
  return { want, pill: ar.w === 0 ? `<span class="pill calm">set aside</span>` : ar.got < want - 10 ? `<span class="pill wait">behind this week</span>` : ar.got > want + 10 ? `<span class="pill calm">ahead this week</span>` : `<span class="pill ok">in balance</span>` }; };
function treeView() {
  const cur = U.nodes.find((n) => n.id === U.at) || null;
  const row = (n) => { const x = n.item && nItem(n), inside = nOpen(n.id), ar = n.area && U.areas.find((a) => a.id === n.area);
    return `<div class="vrow${ar ? "" : " dr"}"${ar ? "" : ` draggable="true" data-node="${esc(n.id)}"`}>${ar ? "" : `<button class="hd" data-u="rowmenu" data-to="${esc(n.id)}" aria-expanded="${U.rowMenu === n.id}" aria-label="Move ${esc(nTitle(n))}">⋮⋮</button>`}<button class="linkq" data-u="drill" data-to="${esc(n.id)}">${esc(nTitle(n))}</button>
      <span class="faint">${ar ? `${inside} open` : x ? `${esc(kindL(x.kind))} · ${esc(x.why)}${inside ? ` · ${inside} inside` : ""}` : `${inside} inside`}</span>
      <span class="row">${ar ? areaState(ar).pill : x ? (x.now ? `<span class="pill think">in Now</span>` : `<button class="btn" data-u="now" data-id="${x.id}">Now</button>`) : ""}<button class="btn quiet" data-u="drill" data-to="${esc(n.id)}" aria-label="Open ${esc(nTitle(n))}">›</button></span></div>${U.rowMenu === n.id ? rowMenu(n) : ""}`; };
  const kids = nKids(U.at).filter((n) => U.at || U.focus === "all" || n.area === U.focus);
  let inner;
  if (!cur) {
    inner = `<div class="cur"><h2>Everything</h2><p class="muted" style="max-width:62ch">Your areas. Open one to see what is inside it. The morning proposal takes its items from here and follows the importance you give each area.</p>
      <div>${kids.map(row).join("")}</div><p class="faint">Areas come from your settings. Open an area to add rows to it.</p></div>`;
  } else {
    const x = cur.item && nItem(cur), ar = cur.area && U.areas.find((a) => a.id === cur.area), st = ar && areaState(ar);
    inner = `<div class="cur">
      <div class="row" style="justify-content:space-between"><h2>${esc(nTitle(cur))}</h2>${ar ? st.pill : x ? (x.now ? `<span class="pill think">in Now</span>` : `<button class="btn" data-u="now" data-id="${x.id}">Now</button>`) : ""}</div>
      ${x ? `<p class="muted">${esc(kindL(x.kind))} · ${esc(x.why)}</p>` : ""}
      ${ar ? `<div class="stack"><div class="balbar"><i style="width:${ar.got}%"></i><b style="left:${st.want}%"></b></div><span class="faint">${ar.got}% of your time this week. The mark is the ${st.want}% you want.</span></div>` : ""}
      <details${U.treeMore ? " open" : ""}><summary data-u="treeMore">More</summary><div class="ar" style="border:0;padding:8px 0 0">
        <label for="${ar ? "u-w-" + ar.id : "u-n-" + cur.id}">Importance<input type="range" id="${ar ? "u-w-" + ar.id : "u-n-" + cur.id}" min="0" max="100" step="5" value="${ar ? ar.w : cur.w}"><span class="code">${ar ? ar.w : cur.w}</span></label>
        <span class="faint">${ar ? "Relative to your other areas. Zero sets the area aside." : "Relative to the rows beside it. Zero sets it aside."}</span>
        ${ar ? "" : `<div class="row">${x ? (x.who === "agent" ? `<span class="pill think">an agent is working on it</span>` : `<button class="btn" data-u="hand" data-id="${x.id}">Hand to an agent</button>`) : ""}<button class="btn" data-u="noop">Focus this month</button><button class="btn" data-u="noop">Rows one after another</button><button class="btn" data-u="noop">Move</button></div>`}</div></details>
      <div>${kids.map(row).join("") || `<p class="muted">Nothing inside yet.${x ? " Once you add a row, this becomes a project." : ""}</p>`}</div>
      <div class="row" style="flex-wrap:nowrap"><input type="text" id="u-add" aria-label="A new row in ${esc(nTitle(cur))}" placeholder="Add a row to ${esc(nTitle(cur))}"><button class="btn" data-u="addrow" style="white-space:nowrap">Add</button></div></div>`;
  }
  const path = []; for (let c = cur && cur.parent; c; c = (U.nodes.find((n) => n.id === c) || {}).parent) path.unshift(U.nodes.find((n) => n.id === c));
  if (cur) path.unshift(null);
  return path.reduceRight((html, n) => `<div class="anc"><button class="anch" data-u="drill" data-to="${n ? esc(n.id) : ""}"${n ? ` data-drop="${esc(n.id)}"` : ""}>‹ ${n ? esc(nTitle(n)) : "Everything"}</button>${html}</div>`, inner);
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
      <button class="btn" data-u="mv" data-to="up" ${i > 0 ? "" : "disabled"}>Up</button><button class="btn" data-u="mv" data-to="down" ${i < s.length - 1 ? "" : "disabled"}>Down</button>
      <button class="btn" data-u="mv" data-to="out" ${p && p.parent ? "" : "disabled"}>Out, next to ${esc(p ? nTitle(p) : "")}</button>
      <button class="btn" data-u="mv" data-to="into" ${i > 0 ? "" : "disabled"}>${i > 0 ? `Into ${esc(nTitle(s[i - 1]))}` : "Into the row above"}</button></div>
    <span class="faint">You can also drag the row. Drop it between rows to reorder, onto a row to put it inside, or onto a frame label above to move it out to that level.</span></div>`;
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
  U.toast = ok ? "Moved." : "That row cannot go there."; dragId = null; render();
});
document.addEventListener("dragend", () => { dragId = null; clearZones(); });

/* Day greeting: one sentence, then what changed since yesterday as links. */
function greetStrip() {
  const has = (id) => U.items.some((x) => x.id === id && x.now);
  const n = U.dfy.groups.filter((g) => !g.undone).reduce((s, g) => s + g.n, 0);
  const chips = [
    has("rate") ? `<button class="gchip" data-u="jump" data-id="rate">${esc(A_NAME)} has a suggestion for you</button>` : "",
    has("inv") ? `<button class="gchip" data-u="jump" data-id="inv">One agent is waiting for a call</button>` : "",
    n ? `<button class="gchip" data-u="dfy">${n === 1 ? "1 thing was" : `${n} things were`} done for you</button>` : "",
    U.rev.closed ? "" : `<button class="gchip" data-u="view" data-id="review">Last week's review is open · about 5 minutes</button>`,
  ].filter(Boolean);
  return chips.length ? `<div class="row" aria-label="Since yesterday">${chips.join("")}</div>` : "";
}

/* Done for you: one line at rest, grouped by what the assistant did and why, with undo per group. */
function doneForYou() {
  const live = U.dfy.groups.filter((g) => !g.undone), n = live.reduce((s, g) => s + g.n, 0);
  return `<div><div class="row" style="justify-content:space-between"><span><span class="eyebrow">Done for you today · ${n}</span> <span class="faint">${live.map((g) => `${g.label} ${g.n}`).join(", ")}</span></span>
      <button class="btn quiet" data-u="dfy" aria-expanded="${U.dfy.open}">${U.dfy.open ? "Hide" : "Show"}</button></div>
    ${U.dfy.open ? U.dfy.groups.map((g) => `<div class="vrow"><span class="linkq">${g.label} · ${g.n}</span><span class="faint">${g.undone ? "Undone. Everything is back where it was." : g.stopped ? esc(A_NAME) + " asks you first from now on." : esc(g.why)}</span>
        <span class="row"><button class="btn quiet" data-u="dfyShow" data-to="${g.id}" aria-expanded="${U.dfy.show === g.id}">${U.dfy.show === g.id ? "Less" : "Details"}</button>${g.undone ? "" : `<button class="btn" data-u="dfyUndo" data-to="${g.id}">Undo</button>`}${g.stopped || g.undone ? "" : `<button class="btn quiet" data-u="dfyStop" data-to="${g.id}">Ask me first</button>`}</span></div>
      ${U.dfy.show === g.id ? `<ul class="plain" style="margin-bottom:8px">${g.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : ""}`).join("") : ""}</div>`;
}

/* Weekly review: four things to look at, each with one decision. */
function reviewView() {
  const R = U.rev, tot = U.areas.reduce((s, a) => s + a.w, 0) || 1;
  const off = U.areas.filter((a) => Math.abs(a.got - Math.round((a.w / tot) * 100)) > 10 || R.area[a.id]);
  const done = [R.seen, off.every((a) => R.area[a.id]), R.stale.every((s) => s.a), R.checks.every((c) => c.a)];
  const n = done.filter(Boolean).length, mark = (i) => (done[i] ? `<span class="pill ok">looked at</span>` : `<span class="pill calm">open</span>`);
  const head = (i, t) => `<div class="row" style="justify-content:space-between"><h3>${t}</h3>${mark(i)}</div>`;
  return `<div class="row" style="justify-content:space-between"><h2>Last week in review</h2><span class="row"><span class="faint">${n} of 4 looked at</span><button class="btn quiet" data-u="view" data-id="day">Back to the day</button></span></div>
    <div class="ar">${head(0, `What you finished · ${R.wins.total}`)}<p class="muted">${R.wins.by}</p><ul class="plain">${R.wins.top.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>
      ${R.seen ? "" : `<div class="row"><button class="btn" data-u="revSeen">Seen</button></div>`}</div>
    <div class="ar">${head(1, "Where your time went")}
      ${U.areas.map((a) => { const want = Math.round((a.w / tot) * 100), isOff = off.includes(a), c = R.area[a.id];
        return `<div class="stack"><span class="row" style="justify-content:space-between"><b>${a.label}</b><span class="faint">${a.got}% of your time, you want ${want}%</span></span><div class="balbar"><i style="width:${a.got}%"></i><b style="left:${want}%"></b></div>
          ${!isOff ? "" : c ? `<span class="faint">${c === "room" ? `Next week's proposal starts with ${a.label}.` : c === "fine" ? "Left as it is." : `You now want less for ${a.label}.`}</span>`
            : a.got < want ? `<div class="row"><button class="btn" data-u="revArea" data-id="${a.id}" data-to="room">Make room next week</button><button class="btn" data-u="revArea" data-id="${a.id}" data-to="lower">I want less of it for now</button><button class="btn quiet" data-u="revArea" data-id="${a.id}" data-to="fine">It was a one-off</button></div>`
            : `<div class="row"><button class="btn" data-u="revArea" data-id="${a.id}" data-to="fine">That was right for this week</button><button class="btn quiet" data-u="revArea" data-id="${a.id}" data-to="room">Hold it back next week</button></div>`}</div>`; }).join("")}</div>
    <div class="ar">${head(2, "What did not move")}
      ${R.stale.map((s) => `<div class="vrow"><span class="linkq">${esc(s.q)}</span><span class="faint">${s.a ? esc(s.a) : s.age}</span><span class="row">${s.a ? "" : `<button class="btn" data-u="revStale" data-id="${s.id}" data-to="Kept.">Keep</button><button class="btn" data-u="revStale" data-id="${s.id}" data-to="Parked.">Park</button><button class="btn quiet" data-u="revStale" data-id="${s.id}" data-to="Let go.">Let it go</button>`}</span></div>`).join("")}</div>
    <div class="ar">${head(3, "Decisions to check")}
      ${R.checks.map((c) => `<div class="stack"><span><b>${esc(c.q)}</b> <span class="faint">${c.on}</span></span><span class="muted">You expected: ${esc(c.expect)}</span>
        ${c.a ? `<span class="pill ok" style="align-self:flex-start">${esc(c.a)}</span>` : `<div class="row"><button class="btn" data-u="revCheck" data-id="${c.id}" data-to="It happened">It happened</button><button class="btn" data-u="revCheck" data-id="${c.id}" data-to="It did not">It did not</button><button class="btn quiet" data-u="revCheck" data-id="${c.id}" data-to="Too early, ask in a month">Too early</button></div>`}</div>`).join("")}</div>
    ${n === 4 ? `<div class="ivy"><span class="from">The review is done</span><p>Monday's proposal follows what you chose here.</p><div class="row"><button class="btn pri" data-u="revClose">Close the review</button></div></div>` : ""}`;
}

/* The Now page as a stream: what is new comes up at the top as a card and leaves once it is dealt with. */
function dfyCard() {
  const live = U.dfy.groups.filter((g) => !g.undone), n = live.reduce((s, g) => s + g.n, 0);
  return `<div class="card"><span class="row" style="justify-content:space-between"><span class="eyebrow">Done for you</span><span class="pill think">new</span></span>
    <span class="q">${n === 1 ? "1 thing was" : `${n} things were`} done for you since yesterday</span>
    <div>${U.dfy.groups.map((g) => `<div class="vrow"><span class="linkq">${g.label} · ${g.n}</span><span class="faint">${g.undone ? "Undone. Everything is back where it was." : g.stopped ? esc(A_NAME) + " asks you first from now on." : esc(g.why)}</span>
        <span class="row"><button class="btn quiet" data-u="dfyShow" data-to="${g.id}" aria-expanded="${U.dfy.show === g.id}">${U.dfy.show === g.id ? "Less" : "Details"}</button>${g.undone ? "" : `<button class="btn" data-u="dfyUndo" data-to="${g.id}">Undo</button>`}${g.stopped || g.undone ? "" : `<button class="btn quiet" data-u="dfyStop" data-to="${g.id}">Ask me first</button>`}</span></div>
      ${U.dfy.show === g.id ? `<ul class="plain" style="margin-bottom:8px">${g.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : ""}`).join("")}</div>
    <div class="row"><button class="btn pri" data-u="dfyDismiss">Looks fine</button></div></div>`;
}
function reviewCard() {
  return `<div class="card"><span class="row" style="justify-content:space-between"><span class="eyebrow">Weekly review</span><span class="pill think">new</span></span>
    <span class="q">Last week's review is open</span><span class="sub">Four things to look at, which takes about five minutes.</span>
    <div class="row"><button class="btn pri" data-u="view" data-id="review">Start the review</button><button class="btn quiet" data-u="revLater">Not today</button></div></div>`;
}

/* Meetings as first-class entries: who, where, what to raise, and one question when they end. */
const evFind = (id) => CAL.day.find((e) => e.id === id);
const areaLabel = (id) => (U.areas.find((a) => a.id === id) || {}).label || id;
function evDetail(ev) {
  const linked = ev.raise.map((id) => U.items.find((x) => x.id === id)).filter(Boolean);
  return `<div class="evd"><span class="faint">${esc(ev.with)} · ${esc(ev.where)}</span>
    <span class="row"><span class="pill calm">${areaLabel(ev.area)}</span><span class="faint">${dur(ev.e - ev.s)}, counts toward ${areaLabel(ev.area)}</span>${ev.join && ev.e > CAL.now ? `<button class="btn" data-u="noop">Join</button>` : ""}</span>
    ${ev.brief && ev.e > CAL.now ? (U.briefOpen[ev.id] ? briefBlock(ev) : `<button class="btn" data-u="brief" data-to="${ev.id}">Prepare me</button>`) : ""}${lastBlock(ev)}
    <span class="eyebrow">${ev.e <= CAL.now ? "What you raised" : "To raise"}</span>
    ${linked.map((x) => `<button class="lk" data-u="jump" data-id="${x.id}">${esc(x.q)}</button>`).join("")}${ev.notes.map((n) => `<span>${esc(n)}</span>`).join("")}${linked.length + ev.notes.length ? "" : `<span class="faint">Nothing yet.</span>`}
    ${ev.e > CAL.now ? `<span class="row" style="flex-wrap:nowrap"><input type="text" id="u-raise" aria-label="Something to raise in ${esc(ev.t)}" placeholder="Something to raise"><button class="btn" data-u="raise">Add</button></span>
      <span class="faint">Ten minutes before, this comes up at the top of your list.</span>` : ""}</div>`;
}
function afterCard() {
  const ev = evFind(U.after);
  return `<div class="card"><span class="row" style="justify-content:space-between"><span class="eyebrow">Meeting ended</span><span class="pill think">new</span></span>
    <span class="q">${esc(ev.t)} ended at ${hm(ev.e)}</span><span class="sub">${esc(ev.with)}. Anything to keep from it?</span>
    <div class="row" style="flex-wrap:nowrap"><input type="text" id="u-after" aria-label="Something to keep from ${esc(ev.t)}" placeholder="A task, a thought, a decision"><button class="btn pri" data-u="afterKeep" style="white-space:nowrap">Keep it</button></div>
    <div class="row"><button class="btn quiet" data-u="afterNone">Nothing to keep</button><span class="faint">A task stays in Threva. The note goes to your notes folder, through the notes adapter.</span></div></div>`;
}

/* Meetings, second pass: a card before the meeting, what you kept last time, and the assistant's brief with the adapter each fact came from. */
const evSoon = () => CAL.day.find((ev) => ev.s > CAL.now && ev.s - CAL.now <= 10 && !U.soonDone[ev.id]) || null;
function lastBlock(ev) {
  const kept = ev.kept && ev.kept.length ? `<span class="eyebrow">Kept today</span><ul class="plain">${ev.kept.map((k) => `<li>${esc(k)}</li>`).join("")}</ul>` : "";
  return `${kept}${ev.last ? `<span class="eyebrow">Last time · ${esc(ev.last.when)}</span><ul class="plain">${ev.last.kept.map((k) => `<li>${esc(k)}</li>`).join("")}</ul><span class="faint">from your ${esc(ev.last.from)}</span>` : ""}`;
}
function briefBlock(ev) {
  const b = ev.brief, open = U.evSrc && U.evSrc.startsWith(ev.id + ":") ? Number(U.evSrc.split(":")[1]) : null;
  return `<div class="ivy" style="align-self:stretch"><span class="from">${esc(A_NAME)}'s brief · prepared at ${b.at}</span><p>${esc(b.text)}</p>
    <div class="row">${b.src.map(([k, ad], i) => `<button class="src" data-u="evsrc" data-to="${ev.id}:${i}" aria-expanded="${open === i}">${k} · ${esc(ad)}</button>`).join("")}</div>
    ${open !== null ? `<div class="excerpt"><p>${esc(b.src[open][2])}</p></div>` : `<span class="faint">Each fact names the adapter it came from. Click one to see what ${esc(A_NAME)} read.</span>`}
    ${b.missing.map((m) => `<span class="row"><span class="pill wait">not read</span><span class="faint">${esc(m)}</span></span>`).join("")}</div>`;
}
function raiseList(ev) {
  const linked = ev.raise.map((id) => U.items.find((x) => x.id === id)).filter(Boolean);
  return linked.length + ev.notes.length ? `<span class="eyebrow">To raise</span><div class="stack" style="align-items:flex-start">${linked.map((x) => `<button class="lk" data-u="jump" data-id="${x.id}">${esc(x.q)}</button>`).join("")}${ev.notes.map((n) => `<span>${esc(n)}</span>`).join("")}</div>` : "";
}
function soonCard(ev) {
  return `<div class="card evd" style="padding:14px 16px"><span class="row" style="justify-content:space-between;align-self:stretch"><span class="eyebrow">In ${ev.s - CAL.now} ${ev.s - CAL.now === 1 ? "minute" : "minutes"}</span><span class="pill think">new</span></span>
    <span class="q">${esc(ev.t)}</span><span class="sub">${esc(ev.with)} · ${esc(ev.where)} · until ${hm(ev.e)}</span>
    ${ev.brief ? briefBlock(ev) : ""}${lastBlock(ev)}${raiseList(ev)}
    <div class="row">${ev.join ? `<button class="btn pri" data-u="noop">Join</button>` : ""}<button class="btn${ev.join ? "" : " pri"}" data-u="soonDone" data-to="${ev.id}">Got it</button></div></div>`;
}

/* Ranger, routines and flows as one idea: who does a row. You, an agent once, or a routine on a schedule. The flow is its steps. */
const rtFind = (id) => U.rt.find((r) => r.id === id);
function routineCards() {
  return U.rt.flatMap((r) => [
    r.pending ? `<div class="card"><span class="row" style="justify-content:space-between"><span class="eyebrow">Routine is waiting</span><span class="pill think">new</span></span>
      <span class="q">${esc(r.name)}</span><span class="sub">${esc(r.pending)}</span>
      <div class="row"><button class="btn pri" data-u="rtOk" data-to="${r.id}">Go ahead</button><button class="btn" data-u="rtSkip" data-to="${r.id}">Not this time</button><button class="btn quiet" data-u="rtAuto" data-to="${r.id}">Go ahead, and stop asking</button></div></div>` : "",
    r.failed && !r.ack ? `<div class="card"><span class="row" style="justify-content:space-between"><span class="eyebrow">Routine failed</span><span class="pill think">new</span></span>
      <span class="q">${esc(r.name)}</span><span class="sub">${esc(r.failed)}</span>
      <div class="row"><button class="btn pri" data-u="rtRetry" data-to="${r.id}">Run it again</button><button class="btn" data-u="rtOpen" data-to="${r.id}">Open the routine</button><button class="btn quiet" data-u="rtAck" data-to="${r.id}">Put away</button></div></div>` : "",
  ]).filter(Boolean);
}
function rtDraftCard() {
  const m = /\b(every\s+[a-z]+(?:\s+(?:morning|evening|afternoon))?(?:\s+at\s+\d[\d:.]*)?|each\s+[a-z]+|daily|weekly|monthly)\b/i.exec(U.rtDraft);
  return `<div class="ivy"><span class="from">This sounds like something to repeat</span><p>“${esc(U.rtDraft)}”</p>
    <span class="faint">When: ${m ? esc(m[1]) : "you choose"} · ${esc(A_NAME)} shows you the steps before the first run · ${esc(A_NAME)} asks you before each run until you say otherwise</span>
    <div class="row"><button class="btn pri" data-u="rtMake">Make it a routine</button><button class="btn" data-u="rtKeep">Keep it as a thought</button></div></div>`;
}
function rtDetail(r) {
  return `<div class="exp" style="padding-left:14px">
    <span class="eyebrow">Steps${r.recipe ? ` · recipe: ${esc(r.recipe)}` : ""}</span>
    <ol class="plain">${r.steps.map(([s, from]) => `<li>${esc(s)} <span class="src">${esc(from)}</span></li>`).join("")}</ol>
    <span class="eyebrow">Last runs</span><ul class="plain">${r.runs.map(([w, res]) => `<li><b>${esc(w)}</b> ${esc(res)}</li>`).join("") || "<li>It has not run yet.</li>"}</ul>
    <div class="row"><div class="seg" role="tablist" aria-label="Before each run"><button role="tab" aria-selected="${r.policy === "ask"}" data-u="rtPolicy" data-to="${r.id}" data-id="ask">Ask me first</button><button role="tab" aria-selected="${r.policy === "auto"}" data-u="rtPolicy" data-to="${r.id}" data-id="auto">Do it on its own</button></div>
      <button class="btn" data-u="rtPause" data-to="${r.id}">${r.paused ? "Resume" : "Pause"}</button><button class="btn" data-u="rtRetry" data-to="${r.id}">Run now</button></div>
    <div class="row" style="flex-wrap:nowrap"><input type="text" id="u-rt-ask" aria-label="Ask ${esc(A_NAME)} to change ${esc(r.name)}" placeholder="Ask ${esc(A_NAME)} to change this routine"><button class="btn" data-u="rtAsk" style="white-space:nowrap">Propose</button></div>
    <span class="faint">${esc(r.when)} · next run ${esc(r.next)}. A change is shown as before and after, and nothing changes until you confirm.</span></div>`;
}
function handedView() {
  const working = U.items.filter((x) => x.who === "agent" || x.kind === "Agent is waiting");
  const state = (r) => `${r.paused ? `<span class="pill calm">paused</span>` : ""}${r.pending ? `<span class="pill wait">waiting for you</span>` : ""}${r.failed && !r.fixed ? `<span class="pill wait">failed</span>` : ""}<span class="pill calm">${r.policy === "ask" ? "asks first" : "on its own"}</span>`;
  return `<p class="muted" style="max-width:66ch">Everything you do not do yourself is listed here. An agent works on a row once, and a routine does something on a schedule. A recipe is the list of steps either of them follows.</p>
    <div class="ar"><h3>Agents working · ${working.length}</h3>
      ${working.map((x) => `<div class="vrow"><button class="linkq" data-u="jump" data-id="${x.id}">${esc(x.q)}</button><span class="faint">${esc(x.doing || x.next || "")}</span><span>${x.kind === "Agent is waiting" ? `<span class="pill wait">waiting for you</span>` : `<span class="pill think">working</span>`}</span></div>`).join("") || `<p class="muted">No agent is working. Open a row under Everything and choose Hand to an agent.</p>`}</div>
    <div class="ar"><h3>Routines · ${U.rt.length}</h3>
      ${U.rt.map((r) => `<div class="vrow"><button class="linkq" data-u="rtOpen" data-to="${r.id}" aria-expanded="${U.rtOpen === r.id}">${esc(r.name)}</button><span class="faint">${esc(r.when)}${r.background ? " · in the background" : ""} · ${esc((r.runs[0] || ["", "not run yet"])[1].split(". ")[0])}</span><span class="row">${state(r)}</span></div>${U.rtOpen === r.id ? rtDetail(r) : ""}`).join("")}
      <span class="faint">To make a new one, type it into the box at the top, for example: ${esc(PACK.examples.routine)}.</span></div>
    <div class="ar"><h3>Recipes · ${U.recipes.length}</h3>
      ${U.recipes.map(([n, steps, by]) => `<div class="vrow"><span class="linkq">${esc(n)}</span><span class="faint">${steps} steps · used by ${esc(by)}</span><span><button class="btn quiet" data-u="noop">Use for a row</button></span></div>`).join("")}</div>`;
}
function railRoutines() {
  const today = U.rt.filter((r) => !r.background && !r.paused);
  return `<div class="slot" style="grid-template-columns:minmax(0,1fr)"><span class="faint">Routines today: ${today.length} on the schedule, ${U.rt.length - today.length} in the background.</span><button class="btn quiet" data-u="view" data-id="handed" style="justify-self:start;padding-left:0">See what is handed over</button></div>`;
}

function studio() {
  const inF = (x) => U.focus === "all" || x.area === U.focus, focusArea = U.areas.find((a) => a.id === U.focus);
  const now = U.items.filter((x) => x.now && inF(x)), rest = U.items.filter((x) => !x.now && inF(x));
  const gaps = calGaps(), cur = gaps.find((g) => g.cur), next = CAL.day.find((ev) => ev.s > CAL.now);
  const card = (x) => { const g = gaps[U.plan[x.id]]; return `<div class="card" id="card-${x.id}"><span class="row" style="justify-content:space-between"><span class="eyebrow">${esc(kindL(x.kind))}</span><span class="row">${x.proposal ? `<span class="pill wait">${esc(A_NAME)} waits on you</span>` : ""}${x.fresh ? `<span class="pill think">new</span><button class="btn quiet" data-u="seen" data-id="${x.id}">Seen, keep it in Now</button>` : ""}</span></span>
      <button class="linkq" data-u="open" data-id="${x.id}" aria-expanded="${U.open === x.id}">${esc(x.q)}</button>
      <span class="sub">${esc(x.next || x.why)}</span>
      ${U.open === x.id ? uPanel(x) : `<div class="row">${x.kind === "Task" ? `<button class="btn" data-u="tick" data-id="${x.id}">Done</button>` : `<button class="btn" data-u="open" data-id="${x.id}">${x.proposal ? "See the suggestion" : "Think it through"}</button>`}
        ${g ? `<span class="faint">Planned for ${hm(g.start)} · ${dur(est(x.id))}</span>` : `<button class="btn" data-u="plan" data-id="${x.id}">Plan it today</button>`}<button class="btn quiet" data-u="now" data-id="${x.id}">Enough for today</button></div>`}</div>`; };
  const line = (x) => `<div class="vrow"><span class="linkq">${esc(x.q)}</span><span class="faint">${x.suggest ? esc(A_NAME) + " would bring this up now. " : ""}${esc(x.why)}</span>
      <span class="row"><button class="btn quiet" data-u="more" data-id="${x.id}" aria-expanded="${U.more === x.id}">${U.more === x.id ? "Less" : "More"}</button><button class="btn" data-u="now" data-id="${x.id}">Now</button></span></div>
    ${U.more === x.id ? `<div class="exp" style="padding-left:14px"><div class="row"><span class="pill calm">${areaLabel(x.area)}</span><span class="pill calm">${x.model === "cloud" ? "cloud" : x.model}</span>${x.tonight ? `<span class="pill think">tonight</span>` : ""}</div>
      <div class="row"><button class="btn" data-u="tonight" data-id="${x.id}">${x.tonight ? "Do not think tonight" : "Think tonight"}</button><button class="btn" data-u="noop">Move to area</button><button class="btn" data-u="noop">Park</button></div></div>` : ""}`;
  const mq = U.merge && U.items.find((x) => x.id === U.merge.id);
  const fresh = now.filter((x) => x.fresh), steady = now.filter((x) => !x.fresh);
  const news = [evSoon() ? soonCard(evSoon()) : "", U.after && (U.focus === "all" || U.focus === evFind(U.after).area) ? afterCard() : "", ...fresh.filter((x) => x.kind === "Agent is waiting").map(card), ...fresh.filter((x) => x.kind !== "Agent is waiting").map(card), ...(U.focus === "all" ? routineCards() : []), U.dfy.card && U.focus === "all" ? dfyCard() : "", U.rev.card && !U.rev.closed && U.focus === "all" ? reviewCard() : ""].filter(Boolean);
  const lists = `${news.length ? `<div class="stack"><span class="eyebrow">New since yesterday · ${news.length}</span>${(U.newAll ? news : news.slice(0, 4)).join("")}${news.length > 4 ? `<button class="btn" data-u="newAll" style="align-self:flex-start">${U.newAll ? "Show fewer" : `Show ${news.length - 4} more new`}</button>` : ""}</div>` : ""}<div class="stack"><span class="eyebrow">Now · questions, tasks, mail and agents in one list</span>${steady.map(card).join("") || `<p class="muted">Nothing needs you. Press Now on anything below.</p>`}</div>
    <div class="stack"><span class="eyebrow">Also on your mind</span>${rest.map(line).join("") || `<p class="muted">Nothing.</p>`}</div>`;
  const body = `
    ${U.toast ? `<div class="toast" role="status">${esc(U.toast)}</div>` : ""}
    <p class="big">${CAL.now < 720 ? "Good morning" : "Good afternoon"}${T_NAME ? `, ${esc(T_NAME)}` : ""}. ${now.length === 0 ? "Nothing needs" : now.length === 1 ? "One thing needs" : `${num(now.length)} things need`} you now${focusArea ? ` in ${focusArea.label}` : ""}. ${cur ? `You are free until ${hm(cur.end)}.` : next ? `Next: ${esc(next.t)} at ${hm(next.s)}.` : ""}</p>

    <div class="row" style="flex-wrap:nowrap"><input type="text" id="u-new" aria-label="A new thought" placeholder="What came up? Try: ${esc(PACK.examples.merge)}"><button class="btn pri" data-u="add" style="white-space:nowrap">Keep it</button></div>
    ${U.rtDraft ? rtDraftCard() : ""}
    ${mq ? `<div class="ivy"><span class="from">${esc(A_NAME)} thinks this belongs to something you already have</span><p>“${esc(U.merge.text)}” sounds like part of <b>${esc(mq.q)}</b></p><div class="row"><button class="btn pri" data-u="mergeYes">Add it there</button><button class="btn" data-u="mergeNo">Keep it separate</button></div></div>` : ""}
    <div class="row" style="justify-content:space-between"><div class="seg" role="tablist" aria-label="Calendar view"><button role="tab" aria-selected="${U.view === "day"}" data-u="view" data-id="day">Day</button><button role="tab" aria-selected="${U.view === "week"}" data-u="view" data-id="week">Week</button><button role="tab" aria-selected="${U.view === "all"}" data-u="view" data-id="all">Everything</button><button role="tab" aria-selected="${U.view === "handed"}" data-u="view" data-id="handed">Handed over</button></div>
      <span class="row"><span class="faint">Focus on</span><div class="seg" role="tablist" aria-label="Focus on">${[{ id: "all", label: "All" }, ...U.areas].map((a) => `<button role="tab" aria-selected="${U.focus === a.id}" data-u="focus" data-id="${a.id}">${a.label}</button>`).join("")}</div></span></div>
    ${U.view === "handed" ? handedView() : U.view === "review" ? reviewView() : U.view === "all" ? treeView() : U.view === "week" ? weekGrid() + lists : `<div class="daygrid"><div style="display:flex;flex-direction:column;gap:16px;min-width:0">${lists}</div>${dayRail()}</div>`}

    <div><span class="eyebrow">Decided today · ${U.log.length}</span>
      <pre class="note">${U.log.length ? esc(U.log.map((h) => "- " + h).join("\n")) : "Nothing yet. Each call you make is listed here."}</pre>
      <div class="row" style="margin-top:8px"><button class="btn" data-u="copy" ${U.log.length ? "" : "disabled"}>${U.copied ? "Copied" : "Copy as a handover"}</button>
        <button class="btn quiet" data-u="noop">Parked · 1</button><button class="btn quiet" data-u="view" data-id="review">Weekly review</button><button class="btn quiet" data-u="dfyBack">Done for you · ${U.dfy.groups.filter((g) => !g.undone).reduce((s, g) => s + g.n, 0)}</button><button class="btn quiet" data-u="keys" aria-expanded="${U.keys}">Keyboard shortcuts</button></div>
      ${U.keys ? `<div class="keys" style="margin-top:8px"><span><kbd>↓</kbd> <kbd>↑</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Y</kbd> yes</span><span><kbd>N</kbd> not quite</span><span><kbd>C</kbd> challenge</span><span><kbd>T</kbd> think tonight</span><span><kbd>P</kbd> park</span><span><kbd>W</kbd> week</span><span><kbd>Alt</kbd> + arrows move a row</span></div>` : ""}</div>`;
  const from = [["From Vera", "The Now list without a cap, the list of what else is on your mind, and loose thoughts that get matched to a question."], ["From Luca", "Thinking opens inside the item. Sources open and can be flagged. Challenge my call first. Every call goes into today's log, which copies as a handover. Mail and waiting agents sit in the same list as questions."], ["From Nora", "Yes or Not quite as the answer to a suggestion from " + A_NAME + ", and the optional reminder to check on a decision later."], ["From your screen", "More on a row, think tonight, parked, reviews due and the keyboard shortcuts, all hidden until you ask for them."], ["From Balance", "The outline is the Everything view. When you open a row it becomes the page, framed by what it sits in, and you can add rows inside it. Any row can hold more rows. The engine's proposal is the Now list. Its reasons show on the rows, such as an area that is behind this week."], ["Greeting, done for you, weekly review", "The Now page is a stream. What is new since yesterday comes up at the top as cards and leaves once you have dealt with it: a waiting agent, a suggestion from " + A_NAME + ", what was done for you, an open review. Done for you shows its groups with a reason and an undo each. The weekly review is four things to look at, each with one decision."], ["From Ranger, routines and flows", "Every row has someone who does it: you, an agent once, or a routine on a schedule. A waiting agent, a routine that asks first and a routine that failed come up in the stream. Handed over lists agents at work, routines and their steps, and recipes. Typing something that repeats offers to make it a routine."], ["Calendar", "The day sits beside the list, with the free time between meetings. Plan it today puts an item into the next free time that fits. The week shows which question belongs to which day. A meeting opens to who, where and what you want to raise. When it ends, it asks once whether there is anything to keep. Ten minutes before, it comes up at the top with what you kept last time and " + A_NAME + "'s brief. Every fact in the brief names the adapter it came from, and the brief says what it could not read."]];
  return `<div style="display:flex;flex-direction:column;gap:26px">
    <div class="frame"><div class="bar"><b>Day</b><span class="row"><span>Prototype clock</span><div class="seg" role="tablist" aria-label="Prototype clock">${[[640, "10:40"], [830, "13:50"], [935, "15:35"]].map(([m, l]) => `<button role="tab" aria-selected="${CAL.now === m}" data-u="clock" data-id="${m}">${l}</button>`).join("")}</div></span></div><div class="body">${body}</div></div>
    <section><h2>What was folded in</h2><div class="find" style="grid-template-columns:minmax(0,1fr);max-width:72ch">${from.map(([k, v]) => `<p><b>${k}.</b> ${esc(v)}</p>`).join("")}</div>
      <p class="faint">The start should be easy and still leave room, so the first screen is only a list, an input and the day. Nora's limit of three, her separate question page and Luca's two-pane layout were dropped.</p></section></div>`;
}
function studioAct(a, el) {
  const id = el && el.dataset.id || U.open, it = U.items.find((x) => x.id === id), s = it && ust(it.id);
  U.toast = ""; U.copied = false;
  const done = (text) => { U.log.push(`${it.q}: ${text}`); U.items = U.items.filter((x) => x !== it); U.open = null; delete U.plan[it.id]; };
  if (a === "open") { if (it.kind !== "Task") U.open = U.open === id ? null : id; }
  else if (a === "tick") { done("done"); U.toast = "Done."; }
  else if (a === "src") { const i = Number(el.dataset.i); s.openSrc = s.openSrc === i ? null : i; }
  else if (a === "flag") s.flagged[s.openSrc] = true;
  else if (a === "yes") { it.fresh = false; it.stand = it.proposal; it.proposal = null; it.next = "You stand here now. Decide when you are ready."; U.toast = "Saved. That is where you stand now."; }
  else if (a === "notquite") s.reply = true;
  else if (a === "cancel") s.reply = false;
  else if (a === "send") { s.reply = false; it.proposal = null; it.now = false; it.why = A_NAME + " thinks about your answer tonight."; it.tonight = true; U.open = null; U.toast = "Sent. It comes back tomorrow with a new thought."; }
  else if (a === "challenge") s.challenged = true;
  else if (a === "decide") { if (s.pick === null) return; const fl = Object.keys(s.flagged).map((i) => it.src[i][0]); done(`${s.pick < 2 ? it.opts[s.pick] : s.own || "own call."}${fl.length ? ` (left out as unreliable: ${fl.join(", ")})` : ""}`); U.toast = it.kind === "Mail" ? "Decided. A draft is in your Drafts folder." : it.kind === "Agent is waiting" ? "Decided. The agent continues." : "Closed and kept under Decided today."; }
  else if (a === "close") { done(it.stand); U.toast = "Closed and kept under Decided today."; }
  else if (a === "talk") U.toast = "A conversation with " + A_NAME + " opens here. When it ends, it is added to this item as a summary.";
  else if (a === "now") { it.now = !it.now; it.suggest = false; if (!it.now) delete U.plan[id]; if (U.open === id) U.open = null; }
  else if (a === "view") U.view = id;
  else if (a === "focus") { U.focus = id; U.open = null; }
  else if (a === "newAll") U.newAll = !U.newAll;
  else if (a === "rtOk" || a === "rtAuto" || a === "rtSkip") { const r = rtFind(el.dataset.to); r.runs.unshift(["Just now", a === "rtSkip" ? "Skipped by you." : "Fine. Approved by you."]); r.pending = null; r.next = "next Monday, 09:00"; if (a === "rtAuto") r.policy = "auto"; U.toast = a === "rtSkip" ? "Skipped this time." : a === "rtAuto" ? "Running. It will not ask again." : "Running."; }
  else if (a === "rtRetry") { const r = rtFind(el.dataset.to); r.runs.unshift(["Just now", "Fine. Ran again on your request."]); r.fixed = true; r.ack = true; U.toast = "Ran again. It worked."; }
  else if (a === "rtAck") rtFind(el.dataset.to).ack = true;
  else if (a === "rtOpen") { U.view = "handed"; U.rtOpen = U.rtOpen === el.dataset.to && U.view === "handed" ? null : el.dataset.to; }
  else if (a === "rtPolicy") rtFind(el.dataset.to).policy = el.dataset.id;
  else if (a === "rtPause") { const r = rtFind(el.dataset.to); r.paused = !r.paused; }
  else if (a === "rtAsk") U.toast = A_NAME + " prepares a before and after. Nothing changes until you confirm.";
  else if (a === "rtMake") { const nid = "r" + Date.now(); U.rt.push({ id: nid, name: U.rtDraft, when: "As you wrote it", next: "after you confirm the steps", policy: "ask", steps: [[A_NAME + " works out the steps and shows them to you before the first run", A_NAME]], runs: [] }); U.rtDraft = null; U.view = "handed"; U.rtOpen = nid; U.toast = "Made. It asks you before each run."; }
  else if (a === "rtKeep") { U.items.push({ id: "u" + Date.now(), kind: "Question", now: false, area: "me", model: "cloud", tonight: false, q: U.rtDraft, why: "Added just now." }); U.rtDraft = null; U.toast = "Kept as a thought."; }
  else if (a === "hand") { it.who = "agent"; it.doing = "Started just now"; it.why = "An agent is working on it."; U.toast = "Handed over. It comes back to the top when the agent needs you or is done."; }
  else if (a === "clock") { CAL.now = Number(id); U.open = null; }
  else if (a === "soonDone") U.soonDone[el.dataset.to] = true;
  else if (a === "evsrc") U.evSrc = U.evSrc === el.dataset.to ? null : el.dataset.to;
  else if (a === "brief") U.briefOpen[el.dataset.to] = true;
  else if (a === "ev") U.ev = U.ev === el.dataset.to ? null : el.dataset.to;
  else if (a === "raise") {
    const v = $("#u-raise").value.trim(), ev = evFind(U.ev); if (!v || !ev) return;
    const words = vWords(v), hit = U.items.find((x) => !ev.raise.includes(x.id) && vWords(x.q).some((w) => words.includes(w)));
    if (hit) { ev.raise.push(hit.id); U.toast = `Linked to your question: ${hit.q}`; } else ev.notes.push(v);
  }
  else if (a === "afterKeep") {
    const v = $("#u-after").value.trim(), ev = evFind(U.after); if (!v) return;
    const nid = "m" + Date.now(), proj = "From " + ev.t; (ev.kept ||= []).push(v);
    U.items.push({ id: nid, kind: "Task", proj, now: false, area: ev.area, model: "cloud", tonight: false, q: v, why: `From ${ev.t}, today.` });
    if (!U.nodes.some((n) => n.id === "p-" + ev.area + "-" + proj)) U.nodes.push({ id: "p-" + ev.area + "-" + proj, parent: "a-" + ev.area, title: proj, w: 50 });
    U.nodes.push({ id: nid, parent: "p-" + ev.area + "-" + proj, item: true, w: 50 });
    U.toast = "Kept. Add another, or press Nothing to keep when you are done.";
  }
  else if (a === "afterNone") { U.after = null; }
  else if (a === "seen") it.fresh = false;
  else if (a === "dfyDismiss") { U.dfy.card = false; U.toast = "Put away. It stays under Done for you at the bottom."; }
  else if (a === "dfyBack") { U.dfy.card = true; U.view = "day"; }
  else if (a === "revLater") { U.rev.card = false; U.toast = "Not today. The review stays under Weekly review at the bottom."; }
  else if (a === "rowmenu") U.rowMenu = U.rowMenu === el.dataset.to ? null : el.dataset.to;
  else if (a === "mv") { if (nShift(U.rowMenu, el.dataset.to)) U.toast = "Moved."; }
  else if (a === "dfy") U.dfy.open = !U.dfy.open;
  else if (a === "dfyShow") U.dfy.show = U.dfy.show === el.dataset.to ? null : el.dataset.to;
  else if (a === "dfyUndo") { U.dfy.groups.find((g) => g.id === el.dataset.to).undone = true; U.toast = "Undone."; }
  else if (a === "dfyStop") { U.dfy.groups.find((g) => g.id === el.dataset.to).stopped = true; U.toast = A_NAME + " asks you first from now on."; }
  else if (a === "revSeen") U.rev.seen = true;
  else if (a === "revArea") { U.rev.area[el.dataset.id] = el.dataset.to; if (el.dataset.to === "lower") { const ar = U.areas.find((x) => x.id === el.dataset.id); ar.w = Math.max(5, Math.round(ar.w / 2)); } }
  else if (a === "revStale") U.rev.stale.find((s) => s.id === el.dataset.id).a = el.dataset.to;
  else if (a === "revCheck") U.rev.checks.find((c) => c.id === el.dataset.id).a = el.dataset.to;
  else if (a === "revClose") { U.rev.closed = true; U.view = "day"; U.toast = "Review closed. Monday's proposal follows it."; }
  else if (a === "drill") { U.at = el.dataset.to || null; U.treeMore = false; }
  else if (a === "treeMore") U.treeMore = !U.treeMore;
  else if (a === "addrow") {
    const v = $("#u-add").value.trim(), cur = U.nodes.find((n) => n.id === U.at); if (!v || !cur) return;
    const nid = "n" + Date.now();
    U.items.push({ id: nid, kind: "Task", now: false, area: nArea(cur).id, model: "cloud", tonight: false, q: v, why: "Added just now." });
    U.nodes.push({ id: nid, parent: cur.id, item: true, w: 50 });
    U.toast = `Added to ${nTitle(cur)}.`;
  }
  else if (a === "plan") { const gs = calGaps().filter((g) => !g.past); const g = gs.find((x) => x.left >= est(id)) || gs.at(-1); if (g) { U.plan[id] = g.i; U.toast = `Planned for ${hm(g.start)}.`; } }
  else if (a === "later") { if (calGaps()[U.plan[id] + 1]) U.plan[id]++; }
  else if (a === "unplan") delete U.plan[id];
  else if (a === "jump") { U.view = "day"; if (it.now) U.open = id; else U.toast = "That question is under Also on your mind. Press Now to bring it up."; }
  else if (a === "more") U.more = U.more === id ? null : id;
  else if (a === "tonight") it.tonight = !it.tonight;
  else if (a === "keys") U.keys = !U.keys;
  else if (a === "add") {
    const v = $("#u-new").value.trim(); if (!v) return;
    if (/\b(every|each|daily|weekly|monthly)\b/i.test(v)) { U.rtDraft = v; return; }
    const words = vWords(v), hit = U.items.find((x) => vWords(x.q + " " + (x.read || "")).some((w) => words.includes(w)));
    if (hit) U.merge = { text: v, id: hit.id };
    else { U.items.push({ id: "u" + Date.now(), kind: "Question", now: false, area: "me", model: "cloud", tonight: false, q: v, why: "Added just now." }); U.toast = "Kept. It is in the list below."; }
  }
  else if (a === "mergeYes") { U.merge = null; U.toast = "Added to that question. " + A_NAME + " brings it up next time."; }
  else if (a === "mergeNo") { U.items.push({ id: "u" + Date.now(), kind: "Question", now: false, area: "me", model: "cloud", tonight: false, q: U.merge.text, why: "Added just now." }); U.merge = null; U.toast = "Kept as its own question."; }
  else if (a === "copy") { const txt = U.log.map((h) => "- " + h).join("\n"); try { navigator.clipboard.writeText(txt).catch(() => {}); } catch (e) {} U.copied = true; }
}
document.addEventListener("change", (e) => { if (e.target.name === "u-opt") { const s = ust(U.open); s.pick = Number(e.target.value); s.challenged = false; render(); } });
document.addEventListener("input", (e) => { if (e.target.id === "u-own") ust(U.open).own = e.target.value; });

/* ---------- Scenario packs: everything a scenario owns. The functions above are shared. ---------- */
const SCENARIO_LIST = [
  { key: "coach", label: "Coaching and therapy", blurb: "Self-employed, working with individuals, couples, groups and schools.",
    intro: "Imagine you are a self-employed coach for Nonviolent Communication, working with individuals, couples, groups and schools. It is Wednesday morning, 10:40." },
  { key: "knowledge", label: "Knowledge work", blurb: "Self-employed security consulting, plus an evening course and an article every week.",
    intro: "Imagine you are a self-employed consultant who advises companies and town councils on information security. You also teach an evening course and write an article every week. It is Wednesday morning, 10:40." },
  { key: "manager", label: "Leadership", blurb: "Leading a team of eight in a mid-sized company.",
    intro: "Imagine you lead a team of eight people in a mid-sized company. It is Wednesday morning, 10:40." },
  { key: "dev", label: "Software development", blurb: "Building software in a small product team, together with coding agents.",
    intro: "Imagine you build software in a small product team and hand part of the work to agents. It is Wednesday morning, 10:40." },
];
const itm = (id, kind, area, now, o) => ({ id, kind, now, area, model: "cloud", tonight: false, ...o });
const MTG_TIMES = { m1: [540, 630], m2: [750, 795], m3: [840, 930], m4: [1020, 1080] };
const mtg = (id, t, o) => ({ s: MTG_TIMES[id][0], e: MTG_TIMES[id][1], t, id, raise: [], notes: [], ...o });
const packEst = () => ({ ws: 45, rate: 20, probono: 15, inv: 10, print: 10 });
/* The walk-through texts. g carries what differs per scenario; the rest is the same in every pack. */
const packGuide = (A, ex, g) => ({
  first: { task: "Look at the page for half a minute without clicking anything. What is it for, and what would you do first?" },
  suggest: { task: `${A}, your assistant, has a suggestion ${g.suggestTopic}. Read it and answer it.`,
    hint: `The card ${g.suggestCard} is at the top under “New since yesterday”. At the bottom of the card there are two buttons: “Yes, that is where I stand” and “Not quite”.` },
  decide: { task: `${g.decide} See what the agent relies on and ask for the case against your choice. Then decide.`,
    hint: "Open the card with “Think it through”. Choose an option, press “Challenge my call first”, then decide with “Decide and tell the agent”." },
  capture: { task: `Something just occurs to you: “${ex.merge}”. Keep it.`,
    hint: `Type the sentence into the box at the top and press “Keep it”. See what ${A} suggests next.` },
  plan: { task: `${g.plan} Plan it into your day. Then you change your mind and want to do it later in the day.`,
    hint: "The card has a button “Plan it today”. The task then shows up in the calendar on the right. There you find “Later”." },
  dfy: { task: `${A} has taken care of a few things since yesterday without asking. Find out what. Then undo the mail tidying.`,
    hint: "Look for the card “Done for you”. If you cannot see it, there is a button under “New since yesterday” that shows more cards. Next to “Mail tidied” there is “Undo”." },
  meeting: { task: `At 14:00 you have ${g.meeting}. Set the prototype clock at the top right to 13:50. What do you now know about the meeting, and where does each fact come from?`,
    hint: "The clock is at the top right, in the grey bar. A new card then comes up at the very top. Click the small source tags on it." },
  tree: { task: `You want to see everything that is waiting in the area ${g.area}. Then add a new row ${g.projIn}: “${ex.row}”.`,
    hint: `At the top, switch from “Day” to “Everything”. Open “${g.area}”, then “${g.proj}”. At the bottom there is a text box with “Add” next to it.` },
  routine: { task: `You want ${g.routineWish}. Set that up.`,
    hint: `Type it into the box at the top, the way you would say it: “${ex.routine}”. Press “Keep it” and then “Make it a routine”.` },
  review: { task: "Open the weekly review and go through it.",
    hint: "At the very bottom of the page there is “Weekly review”. Each of the four parts needs an answer from you. At the end, press “Close the review”." },
});

const SCENARIOS = {
  coach: (A) => {
    const examples = { merge: "ask the head teacher for an example", routine: "every Friday list the open quotes", row: "Book the room" };
    return {
      areas: [{ id: "clients", label: "Clients", w: 40, got: 55 }, { id: "business", label: "Business", w: 30, got: 38 }, { id: "me", label: "Me", w: 30, got: 7 }],
      proj: { ws: "School workshop", probono: "Parents' association", rate: "Practice", inv: "Practice", train: "Training", evening: "Offers", news: "Offers" },
      est: packEst(),
      items: [
        itm("ws", "Question", "clients", true, { q: "How do I open the conflict workshop for the school team?", why: "The workshop is in five days.", next: "Open point from Monday: who brings the example?",
          prior: { when: "You talked it through on Monday", before: "Start with the theory, then practise.", after: "Open with one real example from the team. The four steps come after the break.",
            settled: ["Open with a real example instead of theory.", "Keep the four steps for after the break."], open: ["Who brings the example, you or the head teacher?"],
            turns: [["You", "I normally always start with the four steps. But with this team I don't know if that works."], [A, "Two teachers said they had heard the theory before. What did they ask for?"], ["You", "Something from their own staff room."], [A, "Then start there. Who could bring that example?"]] },
          read: "The head teacher wrote on Friday that she can give you ten minutes before the workshop. According to your notes the team trusts her and two teachers are wary of outside trainers. The notes also say the team wants an example from its own staff room.",
          src: [["mail from the head teacher, Fri", "I can meet you at 8:20, ten minutes before we start."], ["your notes, first call", "Team trusts the head. Two teachers sceptical of external trainers."]],
          opts: ["I ask the head teacher to bring the example.", "I bring an example from another school."],
          counter: ["If the example is hers, the team may hear it as her side of a conflict they are part of.", "The two wary teachers asked for something from their own staff room."] }),
        itm("rate", "Question", "business", true, { q: "Do I raise my rate for the spring block?", why: "Two clients asked for spring dates this week.", next: `${A} has a suggestion for you.`,
          stand: "I should probably leave it as it is.", proposal: "Raise the rate by 8 percent for new bookings. Keep the old rate for the two who already asked.",
          read: "Both clients who asked for spring dates paid last year's rate without comment. Your room rent and insurance rose by about 6 percent since then.",
          src: [["invoices, last 12 months", "14 invoices at the current rate. Nobody asked for a discount or got one."], ["two mails this week", "Both ask for dates in March. Neither mentions price."], ["rent and insurance statements", "Room rent up 5 percent from January, insurance up 9 percent."]] }),
        itm("probono", "Mail", "clients", true, { q: "Request: a free workshop for the parents' association", why: "The request is nine days old.", next: "Needs an answer. A reply can be drafted once you decide.",
          read: "They ask for a free evening in January. You gave two free evenings this year, and wrote in September that two is your limit.",
          src: [["mail from the association, 2 Nov", "We have no budget, but 40 parents would come."], ["your note, September", "Pro bono: two per year. Both used."]],
          opts: ["Decline, and offer the paid evening group at a reduced rate.", "Accept once more, as a way into the school."],
          counter: ["40 parents is the largest audience you were offered this year.", "Accepting would break the limit you set for yourself eight weeks ago, in September."] }),
        itm("inv", "Agent is waiting", "business", true, { q: "Three invoices are late. Send the reminders?", why: "The agent prepared three reminders and will not send them by itself.", next: "It continues once you have decided.",
          read: "Two invoices are 20 days late. The third is 35 days late, from a client you see again on Thursday.",
          src: [["open invoices", "Two at 20 days, one at 35 days."], ["calendar, Thursday", "Session with the third client at 14:00."]],
          opts: ["Send all three reminders.", "Send two. I raise the third in person on Thursday."],
          counter: ["The third client gets a formal reminder one day before sitting in your room.", "This client was also late in spring, and you did not raise it then."] }),
        itm("train", "Question", "me", false, { suggest: true, tonight: true, q: "Should I take the mediation training?", why: "The Me area is behind this week. Early booking ends on Tuesday." }),
        itm("evening", "Question", "business", false, { q: "Do I offer the evening group again?", why: "Registration would open in January." }),
        itm("news", "Question", "business", false, { q: "What goes into the January newsletter?", who: "agent", doing: "Drafting three topic ideas from last quarter's questions, since 09:12", why: "An agent is drafting ideas for it." }),
        itm("print", "Task", "clients", true, { proj: "School workshop", q: "Send the workshop handout to print", why: "Due Friday.", next: "Takes ten minutes and is due Friday." }),
        itm("room", "Task", "business", false, { proj: "Practice", q: "Renew the room contract", why: "Due 30 November." }),
        itm("walk", "Task", "me", false, { proj: "Health", q: "Book the physio appointment", why: "No date is attached." }),
      ],
      day: [
        mtg("m1", "Client session", { area: "clients", with: "Jonas, individual session", where: "Practice room" }),
        mtg("m2", "Lunch with Mara", { area: "me", with: "Mara", where: "Café at the station" }),
        mtg("m3", "Couple session", { area: "clients", with: "A couple, third session", where: "Practice room", notes: ["Ask how the listening exercise went"],
          last: { when: "Second session, 28 October", from: "notes folder", kept: ["They agreed on one listening exercise a day.", "He was reluctant. Check in with him first."] },
          brief: { at: "13:45", text: "This is the third session. Last time they agreed on one listening exercise a day, and you wanted to ask how it went. She wrote on 1 November that she wants to talk about the move. That has not come up in a session yet.",
            src: [["calendar", "desk-ics", "Couple session, 14:00 to 15:30, practice room. Third in the series."], ["notes", "notes folder", "28 Oct: Agreed: one listening exercise a day. He was reluctant."], ["mail", "desk-imap", "1 Nov: Could we talk about the move next time?"]], missing: [] } }),
        mtg("m4", "Evening group", { area: "clients", with: "Six people", where: "Online", join: true, raise: ["evening"],
          last: { when: "4 November", from: "notes folder", kept: ["Two people asked for a later start."] },
          brief: { at: "16:45", text: "Six people are signed up. Last week two asked for a later start, which fits your open question about offering the group again.",
            src: [["calendar", "desk-ics", "Evening group, weekly, online."], ["notes", "notes folder", "4 Nov: Two people asked for a later start."]], missing: [`The group chat has no adapter in Threva, so ${A} did not read it.`] } }),
      ],
      week: [
        { d: "Wed 11", today: true, ev: [["9:00", "Client session"], ["12:30", "Lunch with Mara"], ["14:00", "Couple session"], ["17:00", "Evening group"]], link: [] },
        { d: "Thu 12", ev: [["9:00", "Client session"], ["14:00", "Session with the late-paying client"]], link: [["inv", "Late invoice: raise it here?"]] },
        { d: "Fri 13", ev: [["10:00", "Supervision group"]], link: [] },
        { d: "Sat 14", ev: [], link: [] },
        { d: "Sun 15", ev: [], link: [] },
        { d: "Mon 16", ev: [["8:20", "Head teacher, ten minutes"], ["8:30", "Conflict workshop, school team"]], link: [["ws", "How do I open the workshop?"]] },
        { d: "Tue 17", ev: [["18:00", "Evening group"]], link: [["train", "Early booking for the training ends"]] },
      ],
      dfy: [
        { id: "mail", label: "Mail tidied", n: 11, why: "You marked mail like this Unimportant three times.", items: ["Deleted 9 mails from two newsletter digests", "Archived 2 booking confirmations"] },
        { id: "agent", label: "Agent tasks retried", n: 1, why: "You allowed one retry for failed tasks.", items: ["The invoice export failed at 06:10 and worked on the second try"] },
        { id: "file", label: "Thoughts filed", n: 2, why: "Both matched a question you already have.", items: ["“Ask about parking at the school” went to School workshop", "“Room rent letter” went to Practice"] },
        { id: "rt", label: "Routines ran", n: 12, why: "They are set to run on their own.", items: ["Morning mail summary: fine", "Booking page: 42 checks since midnight, no new request", "Backup at 22:00 failed; see the card above"] },
      ],
      rev: { wins: { total: 9, by: "Clients 5 · Business 3 · Me 1", top: ["Held the first call with the school team", "Sent the spring dates to two clients", "Finished the September accounts"] },
        stale: [{ id: "s1", q: "New website text for couples coaching", age: "untouched for five weeks", a: null }, { id: "s2", q: "Which three clients do I ask for a testimonial?", age: "untouched for four weeks", a: null }],
        checks: [{ id: "c1", q: "Stop offering single trial sessions", on: "decided 2 September", expect: "No fewer first bookings in October.", a: null }] },
      rt: [
        { id: "r1", name: "Morning summary of new client mail", when: "Every weekday at 07:30", next: "tomorrow, 07:30", policy: "auto", recipe: "Summarise new mail",
          steps: [["Read unread mail from clients", "mail · desk-imap"], ["Summarise each mail in two lines", A], ["Put the summary at the top of the day", "Threva"]], runs: [["Today, 07:30", "Fine. Three mails summarised."], ["Yesterday, 07:30", "Fine. One mail summarised."]] },
        { id: "r2", name: "Update the dates page on the website", when: "Every Monday at 09:00", next: "waiting for you", policy: "ask", pending: "The routine wants to publish the two spring dates you sent to clients last week.",
          steps: [["Read the confirmed dates", "calendar · desk-ics"], ["Write the new dates page", A], ["Publish the page", "website · no adapter yet, by mail to your web host"]], runs: [["Monday, 09:00", "Waiting for your approval."], ["2 November", "Fine. Page published."]] },
        { id: "r3", name: "Back up session notes", when: "Every day at 22:00", next: "today, 22:00", policy: "auto", failed: "Yesterday at 22:00 the backup folder could not be reached. The notes are unchanged and nothing was lost.",
          steps: [["Collect notes changed today", "notes · notes folder"], ["Copy them to the backup folder", "files · backup drive"]], runs: [["Yesterday, 22:00", "Failed. The backup folder could not be reached."], ["9 November, 22:00", "Fine. Four notes copied."]] },
        { id: "r4", name: "Friday accounts: list unpaid invoices", when: "Every Friday at 16:00", next: "Friday, 16:00", policy: "auto", recipe: "Remind about late invoices",
          steps: [["Read open invoices", "accounts · no adapter yet, from a spreadsheet"], ["List the ones older than 14 days", A], ["Hand the list to an agent that prepares reminders", "agent"]], runs: [["6 November, 16:00", "Fine. Three invoices listed."]] },
        { id: "r5", name: "Watch the booking page", when: "Every 15 minutes", next: "in a few minutes", policy: "auto", background: true,
          steps: [["Check the booking page for new requests", "website"], ["Tell me only when there is one", "Threva"]], runs: [["Today", "42 checks, no new request."]] },
      ],
      recipes: [["Summarise new mail", 3, "Morning summary of new client mail"], ["Remind about late invoices", 3, "Friday accounts"]],
      examples,
      guide: packGuide(A, examples, { suggestTopic: "about your rate", suggestCard: "about your rate",
        decide: "An agent has prepared reminders for three late invoices and is waiting for you.",
        plan: "You want to send the workshop handout to print today.", meeting: "a couple session",
        area: "Clients", proj: "School workshop", projIn: "to the school workshop", routineWish: "the open quotes listed automatically every Friday" }),
    };
  },

  knowledge: (A) => {
    const examples = { merge: "ask the head of communications about the press", routine: "every Monday list the new enquiries", row: "Book the meeting room" };
    return {
      areas: [{ id: "clients", label: "Clients", w: 45, got: 58 }, { id: "business", label: "Teaching", w: 25, got: 30 }, { id: "me", label: "Me", w: 30, got: 12 }],
      proj: { ws: "Crisis exercise", probono: "Requests", rate: "Workshop offer", inv: "Council project", train: "Training", evening: "Evening course", news: "Weekly article" },
      est: packEst(),
      items: [
        itm("ws", "Question", "clients", true, { q: "How do I set up the crisis exercise for the executive team?", why: "The kickoff is today at 14:00.", next: "Open point from Monday: who plays the press?",
          prior: { when: "You talked it through on Monday", before: "Start with the crisis manual, then practise.", after: "Open with a realistic incident. The crisis manual comes in the debrief.",
            settled: ["Open with a realistic incident instead of the manual.", "Keep the crisis manual for the debrief."], open: ["Who plays the press, you or someone from the company?"],
            turns: [["You", "I usually start with the crisis manual. I'm not so sure that works with this executive team."], [A, "In the first call, two of them said they know the manual. What did they ask for?"], ["You", "Something that could really happen to them."], [A, "Then start there. Who could play the press in the exercise?"]] },
          read: "Sara wrote on Friday that the head of communications would be free on the day of the exercise. Your notes say the executive team knows the crisis manual and that two members think exercises like this are theatre. They asked for an incident that could really happen to them.",
          src: [["mail from Sara, Fri", "Our head of communications would be free on the day of the exercise, if you need her."], ["your notes, first call", "Executive team knows the manual. Two think exercises are theatre."]],
          opts: ["I ask the head of communications to play the press.", "I play the press myself."],
          counter: ["In a real crisis she would have to answer the press herself. If she plays the press, she does not practise her own role.", "You run the exercise, so you cannot also watch how the executive team decides."] }),
        itm("rate", "Question", "business", true, { q: "Do I offer the workshop as a half day or a full day?", why: "Two companies asked about the workshop this week.", next: `${A} has a suggestion for you.`,
          stand: "I should probably keep offering both.", proposal: "From now on, offer the workshop as a full day only. The two companies that already asked can still choose.",
          read: "Of nine workshops in the last twelve months, six were full days. After all three half days you noted that there was not enough time for the exercise at the end.",
          src: [["bookings, last 12 months", "Nine workshops: six full days, three half days."], ["your notes after the half days", "Noted three times: the exercise at the end was cut short."], ["two enquiries this week", "Both ask for dates in January. Neither mentions a length."]] }),
        itm("probono", "Mail", "clients", true, { q: "Request: a free guest talk at the local business association", why: "The request is nine days old.", next: "Needs an answer. A reply can be drafted once you decide.",
          read: "They ask for a free talk in January. You gave two free talks this year, and wrote in September that two is your limit.",
          src: [["mail from the business association, 2 Nov", "We cannot pay a fee, but around 60 local companies will come."], ["your note, September", "Free talks: two per year. Both used."]],
          opts: ["Decline, and offer a paid talk at a reduced fee.", "Accept once more, as a way to new clients."],
          counter: ["60 companies is the largest audience you were offered this year.", "Accepting would break the limit you set for yourself eight weeks ago, in September."] }),
        itm("inv", "Agent is waiting", "clients", true, { q: "The status report for the council project is ready. Send it?", why: "The agent prepared the weekly report and will not send it by itself.", next: "It continues once you have decided.",
          read: "The report shows that the rollout of two-factor sign-in is two weeks late. On Thursday you sit in the steering committee with the client.",
          src: [["draft of the status report", "Two-factor sign-in: planned 13 Nov, now 27 Nov."], ["calendar, Thursday", "Steering committee, council project, at 14:00."]],
          opts: ["Send the report now, with the delay in it.", "Hold it back. I explain the delay myself on Thursday and send the report afterwards."],
          counter: ["The client reads about a two-week delay one day before you meet and has not heard your explanation yet.", "The report normally arrives every Wednesday. If it is missing this week, that will probably be noticed more than the delay."] }),
        itm("train", "Question", "me", false, { suggest: true, tonight: true, q: "Should I take the information security certification?", why: "The Me area is behind this week. Early booking ends on Tuesday." }),
        itm("evening", "Question", "business", false, { q: "Do I teach the evening course again next semester?", why: "The school wants to know by January." }),
        itm("news", "Question", "business", false, { q: "What do I write the next article about?", who: "agent", doing: "Drafting three topic ideas from this week's security advisories, since 09:12", why: "An agent is drafting ideas for it." }),
        itm("print", "Task", "clients", true, { proj: "Council project", q: "Export the slides for Thursday", why: "Due Thursday.", next: "Takes ten minutes and is due Thursday." }),
        itm("room", "Task", "business", false, { proj: "Evening course", q: "Set the exam date with the course office", why: "Due 30 November." }),
        itm("walk", "Task", "me", false, { proj: "Health", q: "Book the dentist appointment", why: "No date is attached." }),
      ],
      day: [
        mtg("m1", "Project stand-up", { area: "clients", with: "Lea and Tim, council project", where: "Town hall, meeting room 2" }),
        mtg("m2", "Lunch with Mara", { area: "me", with: "Mara", where: "Café at the station" }),
        mtg("m3", "Crisis exercise kickoff", { area: "clients", with: "Sara and Nico from the executive team", where: "At the client's office, meeting room", notes: ["Ask who plays the press"],
          last: { when: "First call, 28 October", from: "notes folder", kept: ["The exercise takes half a day.", "Nico does not want a power cut scenario. They have done that one."] },
          brief: { at: "13:45", text: "This is the kickoff for the crisis exercise. In the first call you agreed on half a day, and Nico did not want a power cut scenario. Sara wrote on 1 November that the board would like to watch. That has not been discussed yet.",
            src: [["calendar", "desk-ics", "Crisis exercise kickoff, 14:00 to 15:30, at the client's office."], ["notes", "notes folder", "28 Oct: Half a day agreed. Nico: no power cut, they have done that one."], ["mail", "desk-imap", "1 Nov: The board would like to watch the exercise. Is that possible?"]], missing: [] } }),
        mtg("m4", "Evening course", { area: "business", with: "22 students", where: "Online", join: true, raise: ["evening"],
          last: { when: "4 November", from: "notes folder", kept: ["Only 14 of 22 attended.", "Two asked whether the course continues in spring."] },
          brief: { at: "16:45", text: "22 students are enrolled, and 14 attended last week. Two asked whether the course continues in spring, which fits your open question about teaching it again.",
            src: [["calendar", "desk-ics", "Evening course, weekly, online."], ["notes", "notes folder", "4 Nov: 14 of 22 attended. Two ask whether it continues in spring."]], missing: [`The course forum has no adapter in Threva, so ${A} did not read it.`] } }),
      ],
      week: [
        { d: "Wed 11", today: true, ev: [["9:00", "Project stand-up"], ["12:30", "Lunch with Mara"], ["14:00", "Crisis exercise kickoff"], ["17:00", "Evening course"]], link: [] },
        { d: "Thu 12", ev: [["9:00", "Risk analysis, interviews"], ["14:00", "Steering committee, council project"]], link: [["inv", "Status report: raise the delay here?"]] },
        { d: "Fri 13", ev: [["10:00", "Finish the article"]], link: [] },
        { d: "Sat 14", ev: [], link: [] },
        { d: "Sun 15", ev: [], link: [] },
        { d: "Mon 16", ev: [["10:00", "Crisis exercise script with Sara"]], link: [["ws", "How do I set up the crisis exercise?"]] },
        { d: "Tue 17", ev: [["16:00", "Office hour for students"]], link: [["train", "Early booking for the certification ends"]] },
      ],
      dfy: [
        { id: "mail", label: "Mail tidied", n: 11, why: "You marked mail like this Unimportant three times.", items: ["Deleted 9 mails from two newsletter digests", "Archived 2 registration confirmations"] },
        { id: "agent", label: "Agent tasks retried", n: 1, why: "You allowed one retry for failed tasks.", items: ["The timesheet export failed at 06:10 and worked on the second try"] },
        { id: "file", label: "Thoughts filed", n: 2, why: "Both matched a question you already have.", items: ["“Ask about parking at the client's office” went to Crisis exercise", "“Collect exam questions” went to Evening course"] },
        { id: "rt", label: "Routines ran", n: 12, why: "They are set to run on their own.", items: ["Morning mail summary: fine", "Security advisories: checked since midnight, none affects your clients", "Backup at 22:00 failed; see the card above"] },
      ],
      rev: { wins: { total: 9, by: "Clients 5 · Teaching 3 · Me 1", top: ["Held the first call for the crisis exercise", "Delivered the risk analysis for the council project", "Prepared and taught the fourth course session"] },
        stale: [{ id: "s1", q: "New text for the services page", age: "untouched for five weeks", a: null }, { id: "s2", q: "Which three clients do I ask for a reference?", age: "untouched for four weeks", a: null }],
        checks: [{ id: "c1", q: "Stop writing quotes without a first call", on: "decided 2 September", expect: "No fewer contracts in October.", a: null }] },
      rt: [
        { id: "r1", name: "Morning summary of new client mail", when: "Every weekday at 07:30", next: "tomorrow, 07:30", policy: "auto", recipe: "Summarise new mail",
          steps: [["Read unread mail from clients", "mail · desk-imap"], ["Summarise each mail in two lines", A], ["Put the summary at the top of the day", "Threva"]], runs: [["Today, 07:30", "Fine. Three mails summarised."], ["Yesterday, 07:30", "Fine. One mail summarised."]] },
        { id: "r2", name: "Publish the weekly article", when: "Every Monday at 09:00", next: "waiting for you", policy: "ask", pending: "The routine wants to publish the article on password rules that you finished on Friday.",
          steps: [["Read the finished article", "notes · notes folder"], ["Write the title and preview text", A], ["Publish the article", "website · no adapter yet, by mail to your web host"]], runs: [["Monday, 09:00", "Waiting for your approval."], ["2 November", "Fine. Article published."]] },
        { id: "r3", name: "Back up notes", when: "Every day at 22:00", next: "today, 22:00", policy: "auto", failed: "Yesterday at 22:00 the backup folder could not be reached. The notes are unchanged and nothing was lost.",
          steps: [["Collect notes changed today", "notes · notes folder"], ["Copy them to the backup folder", "files · backup drive"]], runs: [["Yesterday, 22:00", "Failed. The backup folder could not be reached."], ["9 November, 22:00", "Fine. Six notes copied."]] },
        { id: "r4", name: "Friday hours: add up hours per client", when: "Every Friday at 16:00", next: "Friday, 16:00", policy: "auto", recipe: "Add up hours per client",
          steps: [["Read the hours logged this week", "time tracking · no adapter yet, from a spreadsheet"], ["Add up the hours per client", A], ["Put the overview at the top of the day", "Threva"]], runs: [["6 November, 16:00", "Fine. 31 hours across three clients."]] },
        { id: "r5", name: "Watch security advisories", when: "Every 15 minutes", next: "in a few minutes", policy: "auto", background: true,
          steps: [["Check the advisory feeds for new security advisories", "web"], ["Tell me only when one affects my clients", "Threva"]], runs: [["Today", "42 checks, no advisory affects your clients."]] },
      ],
      recipes: [["Summarise new mail", 3, "Morning summary of new client mail"], ["Add up hours per client", 3, "Friday hours"]],
      examples,
      guide: packGuide(A, examples, { suggestTopic: "about the format of your workshop", suggestCard: "about the workshop",
        decide: "An agent has prepared the weekly status report for the council project and is waiting for you.",
        plan: "You want to export the slides for Thursday today.", meeting: "the kickoff for the crisis exercise",
        area: "Clients", proj: "Crisis exercise", projIn: "to the crisis exercise", routineWish: "the new enquiries listed automatically every Monday" }),
    };
  },

  manager: (A) => {
    const examples = { merge: "ask HR about the role descriptions", routine: "every Monday list who is away this week", row: "Prepare questions and answers" };
    return {
      areas: [{ id: "clients", label: "Team", w: 40, got: 52 }, { id: "business", label: "Projects", w: 35, got: 40 }, { id: "me", label: "Me", w: 25, got: 8 }],
      proj: { ws: "Reorganisation", probono: "Requests", rate: "Headcount planning", inv: "Holiday planning", train: "Training", evening: "Team meeting", news: "Quarterly update" },
      est: packEst(),
      items: [
        itm("ws", "Question", "clients", true, { q: "How do I tell the team about the reorganisation?", why: "The team briefing is in five days.", next: "Open point from Monday: who answers the questions about roles?",
          prior: { when: "You talked it through on Monday", before: "First a mail to everyone, then questions in the team meeting.", after: "Say it in person first, with everyone in the same room. The mail comes afterwards as a summary.",
            settled: ["Say it in person first rather than by mail.", "Send the mail afterwards as a summary."], open: ["Who answers the questions about roles, you or HR?"],
            turns: [["You", "I wanted to send a mail first, so everyone reads the same thing at the same time. With this topic I am not sure that goes down well."], [A, "After the last change, two people on the team said they would rather have heard it from you. What was missing for them?"], ["You", "That they could ask questions straight away."], [A, "Then say it in person. Who could answer the questions about roles?"]] },
          read: "Lea from HR wrote on Friday that she can join on Monday. According to your notes the role changes for two people, and the new role descriptions will not be ready until December. You also noted that the team prefers to hear news from you.",
          src: [["mail from Lea, Fri", "I can join on Monday at 9:00, if you need me."], ["your notes, talk with the head of division", "Two roles change. Role descriptions ready in December."]],
          opts: ["I ask Lea to answer the questions about roles.", "I answer the questions myself and say what is not settled yet."],
          counter: ["With HR in the room the briefing feels more formal, and some people will not ask at all.", "The role descriptions will not be ready until December. On the most important questions you would have to say that you do not know yet."] }),
        itm("rate", "Question", "business", true, { q: "Do I request a second coordinator role?", why: "Headcount planning for next year closes at the end of the month.", next: `${A} has a suggestion for you.`,
          stand: "We can probably get through another year like this.", proposal: "Request a second coordinator role at 60 percent, limited to one year.",
          read: "Tim has coordinated three projects instead of two since spring. His overtime has risen from 12 to 46 hours since then, and two project handovers slipped in October.",
          src: [["time tracking, last 6 months", "Tim: 46 hours of overtime. In May it was 12."], ["project list", "Three running projects that need coordination. In spring there were two."], ["October minutes", "Two handovers moved by a week each, both for lack of coordination."]] }),
        itm("probono", "Mail", "clients", true, { q: "Request: Jonas wants to borrow Sara for two weeks", why: "The request is nine days old.", next: "Needs an answer. A reply can be drafted once you decide.",
          read: "Jonas asks for the first two weeks of December. You lent someone out twice this year, and wrote in September that nobody else leaves before the year-end closing.",
          src: [["mail from Jonas, 2 Nov", "For the rollout we are missing someone who knows the system. Two weeks would be enough."], ["your note, September", "Lending people out: nobody else before the year-end closing."]],
          opts: ["Decline, and offer that Sara is there for questions on two half days.", "Accept, because Jonas also helped out in spring."],
          counter: ["In spring Jonas gave you someone for three weeks without asking any questions.", "Accepting breaks the rule you set in September, and you lose Sara in the middle of the year-end closing."] }),
        itm("inv", "Agent is waiting", "clients", true, { q: "The holiday plan has two overlaps. Send it to the team anyway?", why: "The agent put the holiday plan together and will not send it by itself.", next: "It continues once you have decided.",
          read: "In the week of 21 December Nico and Sara are both away, in the week of 4 January Nico and Tim. You have a one-to-one with Nico on Thursday.",
          src: [["holiday plan, draft", "21 to 24 Dec: Nico and Sara. 4 to 8 Jan: Nico and Tim."], ["calendar, Thursday", "One-to-one with Nico at 14:00."]],
          opts: ["Send the plan as it is and ask the team to sort out the two overlaps among themselves.", "Do not send it yet. I raise it with Nico on Thursday, since both weeks involve Nico."],
          counter: ["Whoever booked first rarely gives way, so the question will probably come back to you later.", "Three people have been waiting for the plan since last week because they want to book their holidays."] }),
        itm("train", "Question", "me", false, { suggest: true, tonight: true, q: "Should I take the leadership course?", why: "The Me area is behind this week. Registration closes on Tuesday." }),
        itm("evening", "Question", "clients", false, { q: "Do I keep the weekly team meeting as it is?", why: "The new meeting schedule starts in January." }),
        itm("news", "Question", "business", false, { q: "What goes into the quarterly update?", who: "agent", doing: "Drafting three topic ideas from this quarter's project reports, since 09:12", why: "An agent is drafting ideas for it." }),
        itm("print", "Task", "clients", true, { proj: "Performance reviews", q: "Print the documents for the performance review", why: "Due Friday.", next: "Takes ten minutes and is due Friday." }),
        itm("room", "Task", "business", false, { proj: "Budget", q: "Submit next year's budget", why: "Due 30 November." }),
        itm("walk", "Task", "me", false, { proj: "Health", q: "Book the optician appointment", why: "No date is attached." }),
      ],
      day: [
        mtg("m1", "One-to-one with Sara", { area: "clients", with: "Sara, monthly one-to-one", where: "Meeting room 3" }),
        mtg("m2", "Lunch with Mara", { area: "me", with: "Mara", where: "Canteen" }),
        mtg("m3", "Steering committee", { area: "business", with: "Head of division and four project leads", where: "Meeting room on the 4th floor", notes: ["Ask when the budget for the customer portal comes"],
          last: { when: "Last meeting, 14 October", from: "notes folder", kept: ["The budget for the customer portal was pushed back by two months.", "The head of division wants to see workload figures."] },
          brief: { at: "13:45", text: "This is the third steering committee this year. Last time the budget for the customer portal was pushed back by two months, and the head of division wanted to see workload figures. Jonas wrote on 1 November that he wants to talk about coordination between the teams. That is not on the agenda yet.",
            src: [["calendar", "desk-ics", "Steering committee, 14:00 to 15:30, meeting room on the 4th floor."], ["notes", "notes folder", "14 Oct: Customer portal budget pushed back by two months. Head of division wants workload figures."], ["mail", "desk-imap", "1 Nov: Can we talk about coordination between the teams in the committee?"]], missing: [] } }),
        mtg("m4", "Team meeting", { area: "clients", with: "Eight people", where: "Online", join: true, raise: ["evening"],
          last: { when: "4 November", from: "notes folder", kept: ["Two people said that an hour is too long."] },
          brief: { at: "16:45", text: "All eight have accepted. Last week two said that an hour is too long, which fits your open question about keeping the team meeting as it is.",
            src: [["calendar", "desk-ics", "Team meeting, weekly, online."], ["notes", "notes folder", "4 Nov: Two people find an hour too long."]], missing: [`The team chat has no adapter in Threva, so ${A} did not read it.`] } }),
      ],
      week: [
        { d: "Wed 11", today: true, ev: [["9:00", "One-to-one with Sara"], ["12:30", "Lunch with Mara"], ["14:00", "Steering committee"], ["17:00", "Team meeting"]], link: [] },
        { d: "Thu 12", ev: [["9:00", "Project planning"], ["14:00", "One-to-one with Nico"]], link: [["inv", "Holiday plan: raise the overlaps here?"]] },
        { d: "Fri 13", ev: [["10:00", "Performance review with Tim"]], link: [] },
        { d: "Sat 14", ev: [], link: [] },
        { d: "Sun 15", ev: [], link: [] },
        { d: "Mon 16", ev: [["8:45", "Lea, quick sync"], ["9:00", "Reorganisation briefing, whole team"]], link: [["ws", "How do I tell the team?"]] },
        { d: "Tue 17", ev: [["16:00", "Division meeting"]], link: [["train", "Registration for the leadership course closes"]] },
      ],
      dfy: [
        { id: "mail", label: "Mail tidied", n: 11, why: "You marked mail like this Unimportant three times.", items: ["Deleted 9 mails from two newsletter digests", "Archived 2 meeting acceptances"] },
        { id: "agent", label: "Agent tasks retried", n: 1, why: "You allowed one retry for failed tasks.", items: ["The time tracking export failed at 06:10 and worked on the second try"] },
        { id: "file", label: "Thoughts filed", n: 2, why: "Both matched a question you already have.", items: ["“Book a meeting room for Monday” went to Reorganisation", "“Dig out the workload figures” went to Headcount planning"] },
        { id: "rt", label: "Routines ran", n: 12, why: "They are set to run on their own.", items: ["Morning mail summary: fine", "Ticket queue: checked since midnight, no ticket has waited too long", "Backup at 22:00 failed; see the card above"] },
      ],
      rev: { wins: { total: 9, by: "Team 5 · Projects 3 · Me 1", top: ["Held all one-to-ones for October", "Delivered the project plan for the customer portal", "Approved the September expenses"] },
        stale: [{ id: "s1", q: "New onboarding checklist", age: "untouched for five weeks", a: null }, { id: "s2", q: "Who do I put forward as my deputy?", age: "untouched for four weeks", a: null }],
        checks: [{ id: "c1", q: "No more meetings on Friday afternoons", on: "decided 2 September", expect: "No more open points on Monday than before.", a: null }] },
      rt: [
        { id: "r1", name: "Morning summary of new team mail", when: "Every weekday at 07:30", next: "tomorrow, 07:30", policy: "auto", recipe: "Summarise new mail",
          steps: [["Read unread mail from the team", "mail · desk-imap"], ["Summarise each mail in two lines", A], ["Put the summary at the top of the day", "Threva"]], runs: [["Today, 07:30", "Fine. Three mails summarised."], ["Yesterday, 07:30", "Fine. One mail summarised."]] },
        { id: "r2", name: "Send the weekly update to the team", when: "Every Monday at 09:00", next: "waiting for you", policy: "ask", pending: "The routine wants to send the update with the two dates you confirmed last week.",
          steps: [["Read the week's decisions and dates", "notes · notes folder"], ["Write the update", A], ["Send it to the team", "mail · desk-imap"]], runs: [["Monday, 09:00", "Waiting for your approval."], ["2 November", "Fine. Update sent."]] },
        { id: "r3", name: "Back up meeting notes", when: "Every day at 22:00", next: "today, 22:00", policy: "auto", failed: "Yesterday at 22:00 the backup folder could not be reached. The notes are unchanged and nothing was lost.",
          steps: [["Collect notes changed today", "notes · notes folder"], ["Copy them to the backup folder", "files · backup drive"]], runs: [["Yesterday, 22:00", "Failed. The backup folder could not be reached."], ["9 November, 22:00", "Fine. Five notes copied."]] },
        { id: "r4", name: "Friday approvals: list open approvals", when: "Every Friday at 16:00", next: "Friday, 16:00", policy: "auto", recipe: "List open approvals",
          steps: [["Read open requests", "HR system · no adapter yet, from a spreadsheet"], ["List the ones waiting longer than five days", A], ["Put the list at the top of the day", "Threva"]], runs: [["6 November, 16:00", "Fine. Four approvals listed."]] },
        { id: "r5", name: "Watch the ticket queue", when: "Every 15 minutes", next: "in a few minutes", policy: "auto", background: true,
          steps: [["Check the queue for tickets waiting longer than two days", "tickets"], ["Tell me only when there is one", "Threva"]], runs: [["Today", "42 checks, no ticket has waited too long."]] },
      ],
      recipes: [["Summarise new mail", 3, "Morning summary of new team mail"], ["List open approvals", 3, "Friday approvals"]],
      examples,
      guide: packGuide(A, examples, { suggestTopic: "about the second coordinator role", suggestCard: "about the coordinator role",
        decide: "An agent has put the holiday plan together, found two overlaps and is waiting for you.",
        plan: "You want to print the documents for the performance review today.", meeting: "the steering committee",
        area: "Team", proj: "Reorganisation", projIn: "to the reorganisation", routineWish: "a list of who is away this week, made automatically every Monday" }),
    };
  },

  dev: (A) => {
    const examples = { merge: "ask Nico about the test environment for the rollback", routine: "every Monday list the open pull requests", row: "Prepare test data" };
    return {
      areas: [{ id: "clients", label: "Product", w: 50, got: 63 }, { id: "business", label: "Operations", w: 25, got: 28 }, { id: "me", label: "Me", w: 25, got: 9 }],
      proj: { ws: "Database migration", probono: "External contributions", rate: "Tests and CI", inv: "Tests and CI", train: "Learning", evening: "On-call", news: "Tech debt" },
      est: packEst(),
      items: [
        itm("ws", "Question", "clients", true, { q: "How do I split up the database migration?", why: "The first step of the migration is in five days.", next: "Open point from Monday: who tests the rollback?",
          prior: { when: "You talked it through on Monday", before: "Switch everything in one step, over a weekend.", after: "Switch only the reads first. The writes follow after the release.",
            settled: ["Reads first instead of everything at once.", "Writes only after the release."], open: ["Who tests the rollback, you or Nico?"],
            turns: [["You", "I wanted to switch everything over one weekend. With this much data I am not sure that goes well."], [A, "Your retrospective says the big switch in spring caused two days of downtime. What would you do differently today?"], ["You", "Smaller steps that can each be rolled back on their own."], [A, "Then start with the reads. Who could test the rollback?"]] },
          read: "Nico wrote on Friday that the test environment is free from Thursday. Your notes say reads make up 80 percent of the load and the rollback has never been tested with real data volumes. The team wants small steps that can each be rolled back on their own.",
          src: [["mail from Nico, Fri", "The test environment is free from Thursday. I do not need it again until Tuesday."], ["your notes, spring retrospective", "Big switch: two days of downtime. Rollback never tested with real data volumes."]],
          opts: ["I ask Nico to test the rollback.", "I test the rollback myself before we start."],
          counter: ["Nico did not write the migration and would have to read up on it first. The test environment is only free until Tuesday.", "You wrote the migration and will mostly test the cases you already thought of."] }),
        itm("rate", "Question", "business", true, { q: "Do we switch the test framework now or after the release?", why: "The release is in two weeks.", next: `${A} has a suggestion for you.`,
          stand: "I should probably wait until after the release.", proposal: "Move only the slow integration tests now. The rest follows after the release.",
          read: "A test run takes 24 minutes on average; in July it was 11. Of 38 failed runs in the last 30 days, 31 passed on the second try, almost always because of an integration test.",
          src: [["CI, last 30 days", "212 runs, 24 minutes on average. 38 failed, 31 of them passed on the second try."], ["CI, July", "11 minutes per run on average."], ["list of flaky tests", "17 tests, 15 of them integration tests."]] }),
        itm("probono", "Mail", "clients", true, { q: "Request: review an external pull request", why: "The request is nine days old.", next: "Needs an answer. A reply can be drafted once you decide.",
          read: "A customer sent a pull request for the CSV export, around 900 lines. You reviewed two external contributions this year, and wrote in September that you take no more before the release.",
          src: [["mail about the pull request, 2 Nov", "We need the export as CSV and went ahead and built it ourselves. Can you take it in?"], ["your note, September", "External contributions: none before the release."]],
          opts: ["Decline until after the release, and name a date for it.", "Review it now, because other customers have asked for the export too."],
          counter: ["Three customers asked for this export, and here it is already built.", "Accepting breaks the rule you set in September, and 900 lines cost you about half a day."] }),
        itm("inv", "Agent is waiting", "business", true, { q: "The build is failing. Merge the prepared fix?", why: "The agent prepared a fix and will not merge it by itself.", next: "It continues once you have decided.",
          read: "The build has been failing since last night because the PDF library got a new version. The fix pins the old version. On Thursday you go through the dependencies with Tim.",
          src: [["CI, last run", "Failing since yesterday, 18:40. Cause: new version of the PDF library."], ["calendar, Thursday", "Dependency review with Tim at 14:00."]],
          opts: ["Merge the fix. The old version stays pinned and the build runs again.", "Do not merge. On Thursday I move to the new version properly with Tim."],
          counter: ["You did not touch the last pinned old version for eight months.", "Until Thursday nobody on the team can ship anything, and the release is in two weeks."] }),
        itm("train", "Question", "me", false, { suggest: true, tonight: true, q: "Should I learn the new programming language properly?", why: "The Me area is behind this week. Early booking for the course ends on Tuesday." }),
        itm("evening", "Question", "business", false, { q: "Do we keep on-call the way it is?", why: "The new on-call rota starts in January." }),
        itm("news", "Question", "business", false, { q: "What goes on the tech debt list?", who: "agent", doing: "Drafting three proposals from last quarter's incidents, since 09:12", why: "An agent is drafting ideas for it." }),
        itm("print", "Task", "clients", true, { proj: "Release", q: "Write the changelog for the release", why: "Due Friday.", next: "Takes ten minutes and is due Friday." }),
        itm("room", "Task", "business", false, { proj: "Infrastructure", q: "Renew the certificate for the test environment", why: "Due 30 November." }),
        itm("walk", "Task", "me", false, { proj: "Personal", q: "Take the bike in for a service", why: "No date is attached." }),
      ],
      day: [
        mtg("m1", "Stand-up and planning", { area: "clients", with: "Nico, Tim and Lea", where: "Team room" }),
        mtg("m2", "Lunch with Mara", { area: "me", with: "Mara", where: "Canteen next door" }),
        mtg("m3", "Architecture review", { area: "clients", with: "Tim and Lea, on the migration design", where: "Meeting room 2", notes: ["Ask whether the read replica is already running in the test environment"],
          last: { when: "First review, 28 October", from: "notes folder", kept: ["Reads go through a separate read replica.", "Lea was sceptical about replication lag. Check in with Lea first."] },
          brief: { at: "13:45", text: "This is the second review of the migration. In the design, reads have gone through a separate read replica since 28 October. Your notes say Lea was sceptical about the replication lag. Tim wrote on 1 November that he wants to talk about backups during the migration. That has not come up in a review yet.",
            src: [["code", "Git adapter", "Migration design: three changes since 28 Oct, read replica set up."], ["notes", "notes folder", "28 Oct: Reads through a separate read replica. Lea sceptical about lag."], ["mail", "desk-imap", "1 Nov: Can we talk about backups during the migration in the review?"]], missing: [] } }),
        mtg("m4", "On-call handover", { area: "business", with: "Nico hands over to you", where: "Online", join: true, raise: ["evening"],
          last: { when: "4 November", from: "notes folder", kept: ["Two alerts in the night, neither a real incident."] },
          brief: { at: "16:45", text: "Nico hands on-call over to you for a week. Last week there were two alerts in the night, neither a real incident. That fits your open question about keeping on-call the way it is.",
            src: [["calendar", "desk-ics", "On-call handover, weekly, online."], ["notes", "notes folder", "4 Nov: Two alerts in the night, neither a real incident."]], missing: [`The ticket system has no adapter in Threva, so ${A} did not read the open incidents.`] } }),
      ],
      week: [
        { d: "Wed 11", today: true, ev: [["9:00", "Stand-up and planning"], ["12:30", "Lunch with Mara"], ["14:00", "Architecture review"], ["17:00", "On-call handover"]], link: [] },
        { d: "Thu 12", ev: [["9:00", "Stand-up"], ["14:00", "Dependency review with Tim"]], link: [["inv", "Failing build: fix it properly here?"]] },
        { d: "Fri 13", ev: [["9:00", "Stand-up"], ["10:00", "Demo for the product team"]], link: [] },
        { d: "Sat 14", ev: [], link: [] },
        { d: "Sun 15", ev: [], link: [] },
        { d: "Mon 16", ev: [["9:00", "Stand-up"], ["10:00", "Migration, first step"]], link: [["ws", "How do I split up the migration?"]] },
        { d: "Tue 17", ev: [["9:00", "Stand-up"], ["16:00", "Sprint retrospective"]], link: [["train", "Early booking for the course ends"]] },
      ],
      dfy: [
        { id: "mail", label: "Mail tidied", n: 11, why: "You marked mail like this Unimportant three times.", items: ["Deleted 9 automatic notifications from two systems", "Archived 2 meeting acceptances"] },
        { id: "agent", label: "Agent tasks retried", n: 1, why: "You allowed one retry for failed tasks.", items: ["The nightly test run failed at 06:10 and passed on the second try"] },
        { id: "file", label: "Thoughts filed", n: 2, why: "Both matched a question you already have.", items: ["“Check the indexes before the migration” went to Database migration", "“Measure how long the tests take” went to Tests and CI"] },
        { id: "rt", label: "Routines ran", n: 12, why: "They are set to run on their own.", items: ["Morning summary of review requests: fine", "Error rate: checked since midnight, always below 1 percent", "Backup at 22:00 failed; see the card above"] },
      ],
      rev: { wins: { total: 9, by: "Product 5 · Operations 3 · Me 1", top: ["Showed the migration design in the first review", "Shipped the search filter for two customers", "Finished the on-call week without an outage"] },
        stale: [{ id: "s1", q: "New setup guide for the development environment", age: "untouched for five weeks", a: null }, { id: "s2", q: "Which three old APIs do we switch off?", age: "untouched for four weeks", a: null }],
        checks: [{ id: "c1", q: "No more deploys on Fridays", on: "decided 2 September", expect: "Fewer incidents at the weekend in October.", a: null }] },
      rt: [
        { id: "r1", name: "Morning summary of new review requests", when: "Every weekday at 07:30", next: "tomorrow, 07:30", policy: "auto", recipe: "Summarise review requests",
          steps: [["Read open review requests", "code · Git adapter"], ["Summarise each request in two lines", A], ["Put the summary at the top of the day", "Threva"]], runs: [["Today, 07:30", "Fine. Three requests summarised."], ["Yesterday, 07:30", "Fine. One request summarised."]] },
        { id: "r2", name: "Publish the release notes", when: "Every Monday at 09:00", next: "waiting for you", policy: "ask", pending: "The routine wants to publish the release notes with the two changes you approved on Friday.",
          steps: [["Read the changes since the last release", "code · Git adapter"], ["Write the release notes", A], ["Publish them on the help page", "website · no adapter yet, by mail to the support team"]], runs: [["Monday, 09:00", "Waiting for your approval."], ["2 November", "Fine. Release notes published."]] },
        { id: "r3", name: "Nightly database backup", when: "Every day at 22:00", next: "today, 22:00", policy: "auto", failed: "Yesterday at 22:00 the backup storage could not be reached. The backup from the day before is complete and nothing was lost.",
          steps: [["Take a snapshot of the database", "database · backup adapter"], ["Copy it to the backup storage", "files · backup drive"]], runs: [["Yesterday, 22:00", "Failed. The backup storage could not be reached."], ["9 November, 22:00", "Fine. 14 GB snapshot copied."]] },
        { id: "r4", name: "Friday tests: list flaky tests", when: "Every Friday at 16:00", next: "Friday, 16:00", policy: "auto", recipe: "List flaky tests",
          steps: [["Read the week's test runs", "CI · build adapter"], ["List all tests that only passed on the second try", A], ["Send the list to the team", "tickets · no adapter, by mail"]], runs: [["6 November, 16:00", "Fine. 17 tests listed."]] },
        { id: "r5", name: "Watch the error rate", when: "Every 15 minutes", next: "in a few minutes", policy: "auto", background: true,
          steps: [["Check the application's error rate", "monitoring"], ["Tell me only when it rises above 2 percent", "Threva"]], runs: [["Today", "42 checks, error rate always below 1 percent."]] },
      ],
      recipes: [["Summarise review requests", 3, "Morning summary of new review requests"], ["List flaky tests", 3, "Friday tests"]],
      examples,
      guide: packGuide(A, examples, { suggestTopic: "about switching the test framework", suggestCard: "about the test framework",
        decide: "An agent has prepared a fix for the failing build and is waiting for you.",
        plan: "You want to write the changelog for the release today.", meeting: "the architecture review",
        area: "Product", proj: "Database migration", projIn: "to the database migration", routineWish: "the open pull requests listed automatically every Monday" }),
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
  CAL = { now: 10 * 60 + 40, label: "Wednesday 11 November", day: P.day, est: P.est, week: P.week };
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
