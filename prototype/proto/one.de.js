/* ---------- Prototype: one or two cards at a time, one bar for capture, search and conversation ---------- */
/* Runs inside the core's scope, so it reuses its state (U, CAL, PACK) and its helpers. */
let SLOTS = 1;
function oneQueue() {
  const now = U.items.filter((x) => x.now);
  const q = [];
  const soon = evSoon(); if (soon) q.push({ k: "soon:" + soon.id, title: soon.t, html: () => soonCard(soon) });
  if (U.after) q.push({ k: "after", title: evFind(U.after).t + " ist vorbei", html: afterCard2 });
  q.push(...sigEntries());
  for (const x of now.filter((x) => x.fresh && x.kind === "Agent is waiting")) q.push(itemEntry(x));
  for (const x of now.filter((x) => x.fresh && x.kind !== "Agent is waiting")) q.push(itemEntry(x));
  for (const r of U.rt.filter((r) => r.pending || (r.failed && !r.ack))) q.push({ k: "rt:" + r.id, title: r.name, html: () => routineCards().find((h) => h.includes(`data-to="${r.id}"`)) || "" });
  for (const x of now.filter((x) => !x.fresh)) q.push(itemEntry(x));
  if (U.dfy.card) q.push({ k: "dfy", title: "Für dich erledigt", html: dfyCard });
  if (U.rev.card && !U.rev.closed) q.push({ k: "rev", title: "Wochenrückblick", html: reviewCard });
  if (U.chat) q.unshift({ k: "chat", title: "Gespräch mit " + A_NAME, html: chatCard });
  const skipped = q.filter((e) => U.skip.includes(e.k)), rest = q.filter((e) => !U.skip.includes(e.k));
  const ordered = [...rest, ...U.skip.map((k) => skipped.find((e) => e.k === k)).filter(Boolean)];
  const pin = ordered.findIndex((e) => e.k === U.pin);
  if (pin > 0) ordered.unshift(ordered.splice(pin, 1)[0]);
  const nu = U.nextUp ? ordered.findIndex((e) => e.k === U.nextUp) : -1;
  if (nu >= 0) { const [e] = ordered.splice(nu, 1); if (ordered[0] && ordered[0].k === U.nextBehind) ordered.splice(1, 0, e); else { ordered.unshift(e); U.nextUp = null; } }
  else if (U.nextUp) U.nextUp = null;
  return ordered;
}
/* A9: the meeting card lists what you noted and says where it went; once there is something, the way out is Fertig. */
function afterCard2() {
  const ev = evFind(U.after), kept = ev.kept || [];
  return `<div class="card"><span class="row" style="justify-content:space-between"><span class="eyebrow">Termin vorbei</span><span class="pill think">neu</span></span>
    <span class="q">${esc(ev.t)} war um ${hm(ev.e)} vorbei</span><span class="sub">${esc(ev.with)}. Gibt es etwas zu notieren?</span>
    ${kept.length ? `<ul class="plain kept">${kept.map((k) => `<li>✓ ${esc(k)}</li>`).join("")}</ul><span class="faint">Notiert unter Alles › ${esc(areaLabel(ev.area))} › Aus ${esc(ev.t)}.</span>` : ""}
    <div class="row" style="flex-wrap:nowrap"><input type="text" id="u-after" aria-label="Etwas notieren aus ${esc(ev.t)}" placeholder="${kept.length ? "Noch etwas?" : "Was aus diesem Termin bleibt, zum Beispiel eine Aufgabe"}"><button class="btn${kept.length ? "" : " pri"}" data-u="afterKeep" style="white-space:nowrap">Notieren</button></div>
    <div class="row"><button class="btn${kept.length ? " pri" : " quiet"}" data-u="afterNone">${kept.length ? "Fertig" : "Nichts zu notieren"}</button></div></div>`;
}
function itemEntry(x) {
  return { k: "i:" + x.id, title: x.q, html: () => {
    const g = calGaps()[U.plan[x.id]];
    return `<div class="card" id="card-${x.id}"><span class="row" style="justify-content:space-between"><span class="eyebrow">${esc(kindL(x.kind))}${sigBadge(x) ? ` · ${sigBadge(x)}` : ""}</span>${x.proposal ? `<span class="pill wait">${esc(A_NAME)} wartet auf dich</span>` : ""}</span>
      <span class="q">${esc(x.q)}</span><span class="sub">${esc(x.next || x.why)}</span>
      ${x.sig && x.sig.length ? (() => { const last = U.sig.find((z) => z.id === x.sig[x.sig.length - 1]); return last ? `<span class="faint">Neu dazu, ${esc(last.ch)} von ${esc(last.from)}: ${esc(last.gist)}</span>` : ""; })() : ""}
      ${U.open === x.id ? uPanel(x) : `<div class="row">${x.kind === "Task" ? `<button class="btn pri" data-u="tick" data-id="${x.id}">Erledigt</button>` : `<button class="btn pri" data-u="${STUDIO_ON && x.kind === "Question" ? "stOpen" : "open"}" data-id="${x.id}">${x.proposal ? "Vorschlag ansehen" : "Durchdenken"}</button>`}
        ${g ? `<span class="faint">Eingeplant um ${hm(g.start)}</span>` : `<button class="btn" data-u="plan" data-id="${x.id}">Heute einplanen</button>`}</div>`}</div>`; } };
}
/* Mira answers with where each matching thing stands, names the most urgent one and offers to bring it forward. */
function chatStatus(h) {
  const id = h.k.split(":").slice(1).join(":");
  if (h.k.startsWith("i:")) { const x = U.items.find((y) => y.id === id); if (!x) return ""; return x.proposal ? `${A_NAME} hat dir einen Vorschlag gemacht: ${x.proposal}` : x.who === "agent" ? `Ein Agent arbeitet daran: ${x.doing || ""}` : x.next || x.why; }
  if (h.k.startsWith("s:")) { const z = U.sig.find((y) => y.id === id); if (!z) return ""; return `${z.gist}${z.st ? ` Schon ${OUTCOME[z.st]}.` : ""}`; }
  if (h.k.startsWith("ev:")) { const ev = CAL.day.find((y) => y.id === id); return ev ? `Termin um ${hm(ev.s)}, mit ${ev.with}.` : ""; }
  if (h.k.startsWith("rto:")) { const r = U.rt.find((y) => y.id === id); return r ? `Routine, ${r.when}.` : ""; }
  return h.where || "";
}
/* A13: every hit gets its own Öffnen, so nothing looks forgotten. A11: "Was hast du heute gemacht?" lists what Mira did, with undo. */
function chatCard() {
  const c = U.chat, head = `<span class="row" style="justify-content:space-between"><span class="eyebrow">Gespräch mit ${esc(A_NAME)}</span><button class="btn quiet" data-u="chatEnd">Beenden</button></span>`;
  const me = `<div class="turn me"><b>Du</b><p>${esc(c.q)}</p></div>`;
  if (c.done) {
    const sig = U.sig.filter((s) => s.st && s.auto), groups = U.dfy.groups.filter((g) => !g.undone);
    return `<div class="card">${head}<div class="turns">${me}<div class="turn"><b>${esc(A_NAME)}</b><div class="say"><p>${sig.length + groups.length ? "Das habe ich heute ohne dich erledigt:" : "Heute habe ich noch nichts ohne dich erledigt."}</p>
      <ul class="plain chatlist">${groups.map((g) => `<li><strong>${esc(g.label)} · ${g.n}</strong><span class="faint">${esc(g.why)}</span><span class="row"><button class="btn quiet" data-u="dfyUndo" data-to="${g.id}">Rückgängig</button></span></li>`).join("")}
      ${sig.map((s) => `<li><strong>${esc(s.from)} · ${esc(s.subj)}</strong><span class="faint">${OUTCOME[s.st]}, nach deiner Regel</span><span class="row"><button class="btn quiet" data-u="sUndo" data-id="${s.id}">Rückgängig</button></span></li>`).join("")}</ul>
      </div></div></div></div>`;
  }
  return `<div class="card">${head}<div class="turns">${me}<div class="turn"><b>${esc(A_NAME)}</b><div class="say"><p>${c.hits.length ? `Dazu weiss ich ${c.hits.length === 1 ? "etwas" : `${num(c.hits.length).toLowerCase()} Dinge`}. Am dringendsten ist das erste.` : "Dazu habe ich noch nichts."}</p>
      ${c.hits.length ? `<ul class="plain chatlist">${c.hits.map((h, i) => `<li><strong>${esc(h.title)}</strong><span class="faint">${esc(chatStatus(h))}</span><span class="row"><button class="btn${i === 0 ? " pri" : ""}" data-u="chatPull" data-id="${h.k}">Öffnen</button></span></li>`).join("")}</ul>` : ""}
      </div></div></div>
    <div class="row"><button class="btn quiet" data-u="chatKeep">${c.hits.length ? "Stattdessen notieren" : "Notieren"}</button></div></div>`;
}
/* Everything the bar can find: list entries, things in the head, meetings and routines. */
function oneIndex() {
  const q = oneQueue(), inQ = new Set(q.map((e) => e.k));
  return [
    ...q.map((e) => ({ k: e.k, title: e.title, where: "Jetzt" })),
    ...U.items.filter((x) => !inQ.has("i:" + x.id)).map((x) => ({ k: "i:" + x.id, title: x.q, extra: x.why, where: "Im Kopf" })),
    ...CAL.day.map((ev) => ({ k: "ev:" + ev.id, title: ev.t, extra: ev.with, where: `Termin ${hm(ev.s)}` })),
    ...U.sig.filter((z) => !inQ.has("s:" + z.id)).map((z) => ({ k: "s:" + z.id, title: `${z.from}: ${z.subj}`, extra: z.gist, where: z.st ? `Eingang, ${OUTCOME[z.st]}` : "Eingang" })),
    ...U.rt.filter((r) => !inQ.has("rt:" + r.id)).map((r) => ({ k: "rto:" + r.id, title: r.name, extra: r.when, where: "Routine" })),
  ];
}
/* Search and questions share one matcher. Filler words are dropped, so "wie ist der Stand beim Workshop" searches for "workshop". */
/* One or two keywords must all match; with three or more, half of them is enough. Most matches first, then your own entries. */
const Q_STOP = new Set(["wie", "ist", "sind", "war", "der", "die", "das", "den", "dem", "des", "beim", "bei", "mit", "und", "oder", "was", "wer", "wo", "wann", "warum", "ich", "mir", "mich", "mein", "meine", "meinem", "meinen", "du", "dir", "zum", "zur", "ein", "eine", "einen", "einem", "gerade", "an", "auf", "für", "von", "vom", "im", "in", "es", "gibt", "habe", "hat", "noch", "schon", "stand", "steht", "stehe", "ansteht", "läuft", "aus", "zu", "um", "über", "bin", "denn", "jetzt", "heute", "neues", "sag", "zeig", "weisst", "weiss", "haben", "wir", "uns", "unser", "unsere", "alles", "etwas", "dazu", "darüber", "dabei", "mal", "bitte", "kannst", "könntest", "gibts", "neue", "sache", "sachen", "thema", "infos", "info"]);
const qStem = (w) => (w.length > 5 ? w.replace(/(en|er|es|e|n|s|t)$/, "") : w);
function oneMatches(text) {
  const t = text.replace(/^\?/, "").trim().toLowerCase(); if (t.length < 2) return [];
  const all = t.split(/[^a-zäöüéèàç0-9]+/).filter((w) => w.length >= 2), keys = all.filter((w) => !Q_STOP.has(w));
  const words = (keys.length ? keys : all).map(qStem); if (!words.length) return [];
  const prio = (e) => (e.k.startsWith("i:") ? 0 : e.k.startsWith("ev:") || e.k.startsWith("rto:") ? 1 : 2);
  return oneIndex().map((e) => { const hay = `${e.title} ${e.extra || ""}`.toLowerCase(); const hit = words.filter((w) => hay.includes(w)); return { e, n: hit.length, hit5: hit.some((w) => w.length >= 5) }; })
    .filter((m) => m.n > 0 && (words.length < 3 ? m.n === words.length || m.hit5 : m.hit5))
    .sort((a, b) => b.n - a.n || prio(a.e) - prio(b.e)).slice(0, 6).map((m) => m.e);
}
/* A question ends with a question mark or starts like one. A leading ? still works. */
const Q_START = /^(wie|was|wo|wohin|woher|wann|wer|wen|wem|warum|weshalb|wieso|welche[rsnm]?|gibt es|kannst du|könntest du|hast du|weisst du|ist|sind|soll|sollte|muss|darf|kann|habe ich|bin ich|steht)(\s|$)/i;
function isQuestion(v) { const t = v.trim(); return t.startsWith("?") || t.endsWith("?") || Q_START.test(t); }
function oneSuggest(text) {
  const v = text.trim(); if (!v) return "";
  const ask = isQuestion(v), body = v.replace(/^\?/, "").trim(), hits = oneMatches(v), short = !ask && hits.length && body.split(/\s+/).length <= 2;
  /* The row Enter takes comes first, so one arrow press down reaches the first match. */
  const keep = `<button data-u="add" class="sg-act${ask ? "" : " sg-def"}"><span>Notieren: «${esc(body)}»</span></button>`;
  const askRow = `<button data-u="ask" class="sg-act${ask ? " sg-def" : ""}"><span>${esc(A_NAME)} fragen: «${esc(body)}»</span></button>`;
  const rows = hits.map((h, i) => `<button data-u="pull" data-id="${h.k}"${short && i === 0 ? ' class="sg-def"' : ""}><span>${esc(h.title)}</span><span class="faint">${esc(h.where)}</span></button>`).join("");
  return `<div class="sugg">${ask ? askRow + rows + keep : short ? rows + keep.replace(" sg-def", "") + askRow : keep + rows + askRow}</div>`;
}
/* Enter and Esc for the card in front: [action, id, to, label]. The rule offer, when shown, takes the keys. */
function cardKeys(e) {
  if (U.interrupt && U.sig.some((y) => y.id === U.interrupt && y.st === null)) return { enter: ["iNow", null, null, "Jetzt ansehen"], esc: ["iLater", null, null, "Nach dieser Karte"] };
  if (U.iFeed) return { enter: ["iYes", null, null, "Ja"], esc: ["iNo", null, null, "Nein"] };
  if (U.ruleOffer) return { enter: ["ruleYes", null, null, "Ja, als Regel"], esc: ["ruleNo", null, null, "Weiter fragen"] };
  if (!e) return null;
  const skip = ["skip", e.k, null, "Nicht jetzt"], [kind, id] = [e.k.split(":")[0], e.k.split(":").slice(1).join(":")];
  if (kind === "after") return { enter: null, esc: ["afterNone", null, null, (evFind(U.after).kept || []).length ? "Fertig" : "Nichts zu notieren"] };
  if (kind === "soon") return { enter: ["soonDone", null, id, "Verstanden"], esc: skip };
  if (kind === "sg") return { enter: ["sgDrop", id, null, "Weglegen"], esc: ["sgLeave", id, null, "Im Mail lassen"] };
  if (kind === "s") { const z = U.sig.find((y) => y.id === id), drop = ["sDrop", id, null, "Weglegen"];
    return z.sug === "attach" ? { enter: ["sAttach", id, null, "Anhängen"], esc: drop } : z.sug === "draft" ? { enter: ["sSend", id, null, z.ch === "Kalender" ? "Zusagen" : "Senden"], esc: drop } : { enter: ["sKeep", id, null, "Behalten"], esc: drop }; }
  if (kind === "rt") { const r = U.rt.find((y) => y.id === id); return r.pending ? { enter: ["rtOk", null, id, "Mach das"], esc: ["rtSkip", null, id, "Diesmal nicht"] } : { enter: ["rtRetry", null, id, "Nochmal ausführen"], esc: ["rtAck", null, id, "Weglegen"] }; }
  if (kind === "i") { const x = U.items.find((y) => y.id === id); if (U.open === id) return { enter: null, esc: ["open", id, null, "Schliessen"] };
    return { enter: x.kind === "Task" ? ["tick", id, null, "Erledigt"] : [STUDIO_ON && x.kind === "Question" ? "stOpen" : "open", id, null, x.proposal ? "Vorschlag ansehen" : "Durchdenken"], esc: skip }; }
  if (kind === "dfy") return { enter: ["dfyDismiss", null, null, "Passt so"], esc: skip };
  if (kind === "rev") return { enter: ["view", "review", null, "Rückblick starten"], esc: ["revLater", null, null, "Heute nicht"] };
  if (kind === "chat" && U.chat.done) return { enter: null, esc: ["chatEnd", null, null, "Beenden"] };
  if (kind === "chat") return { enter: U.chat.hits.length ? ["chatPull", U.chat.hits[0].k, null, "Öffnen"] : ["chatKeep", null, null, "Notieren"], esc: ["chatEnd", null, null, "Beenden"] };
  return { enter: null, esc: skip };
}
const keyHint = (k) => k ? `<div class="keyhint">${k.enter ? `<span><kbd>↵</kbd> ${esc(k.enter[3])}</span>` : ""}${k.esc ? `<span><kbd>Esc</kbd> ${esc(k.esc[3])}</span>` : ""}</div>` : "";
function studioOne() {
  const q = oneQueue(), shown = q.slice(0, SLOTS), after = q.slice(SLOTS);
  const cur = calGaps().find((g) => g.cur);
  const inStudio = STUDIO_ON && U.view === "day" && U.stStack && U.stStack.length;
  U.keysNow = inStudio ? { enter: null, esc: ["stBack", null, null, U.stStack.length > 1 ? "Zurück" : "Studio schliessen"] } : U.view === "day" ? cardKeys(shown[0]) : null;
  const slot = shown.length ? shown.map((e, n) => `<div class="slotcard">${n === 0 ? whyBlock(e, after) : ""}${e.html()}<div class="row" style="justify-content:space-between">${n === 0 && !U.ruleOffer && !U.iFeed && !U.interrupt ? keyHint(U.keysNow) : "<span></span>"}${e.k === "chat" ? "" : `<button class="btn quiet" data-u="skip" data-id="${e.k}">Nicht jetzt</button>`}</div></div>`).join("")
    : `<p class="muted">Nichts braucht dich jetzt. ${cur ? `Du bist bis ${hm(cur.end)} frei.` : ""}</p>`;
  const nextLine = after.length ? `<div class="nextline"><span class="eyebrow">Danach</span>${after.slice(0, 3).map((e) => `<button class="lk" data-u="pull" data-id="${e.k}">${esc(e.title)}</button>`).join("<span class=\"faint\">·</span>")}${after.length > 3 ? `<span class="faint">und ${after.length - 3} weitere</span>` : ""}</div>` : "";
  const dayView = inStudio ? `${interruptBox()}${studioPage()}` : `<div class="daygrid one"><div class="stack" style="gap:12px;min-width:0">${interruptBox()}${iFeedBox()}${ruleOfferBox()}${slot}${nextLine}${sigLine()}</div>${dayRail()}</div>`;
  const body = `
    ${U.toast ? `<div class="toast" role="status">${esc(U.toast)}${(U.toastActs || []).map(([a, i, l]) => ` <button class="lk" data-u="${a}" data-id="${esc(i)}">${esc(l)}</button>`).join("")}</div>` : ""}
    <div class="bar1"><label for="u-new" class="barlabel">Hier tippst du alles ein: einen Gedanken zum Notieren, ein Wort zum Suchen oder eine Frage an ${esc(A_NAME)}.</label><input type="text" id="u-new" autocomplete="off" placeholder="Zum Beispiel: Folien an Tim schicken · Abendkurs · Wie steht es beim Workshop?" value="${esc(U.typed)}"><div id="sugg">${oneSuggest(U.typed)}</div></div>
    ${U.rtDraft ? rtDraftCard() : ""}
    ${U.merge ? (() => { const mq = U.items.find((x) => x.id === U.merge.id); return `<div class="ivy"><span class="from">${esc(A_NAME)} meint, das gehört zu etwas, das du schon hast</span><p>«${esc(U.merge.text)}» klingt nach einem Teil von <b>${esc(mq.q)}</b></p>${(() => { const sh = [...new Set(vWords(U.merge.text).filter((w) => vWords(mq.q + " " + (mq.read || "")).includes(w)))]; return sh.length ? `<p class="faint">Beide nennen ${sh.map((w) => `«${esc((U.merge.text.match(new RegExp(w, "i")) || [w])[0])}»`).join(" und ")}.</p>` : ""; })()}<div class="row"><button class="btn pri" data-u="mergeYes">Dort hinzufügen</button><button class="btn" data-u="mergeNo">Getrennt notieren</button></div></div>`; })() : ""}
    <div class="seg" role="tablist" aria-label="Ansicht" style="align-self:flex-start"><button role="tab" aria-selected="${U.view === "day"}" data-u="view" data-id="day">Tag</button><button role="tab" aria-selected="${U.view === "week"}" data-u="view" data-id="week">Woche</button><button role="tab" aria-selected="${U.view === "all"}" data-u="view" data-id="all">Alles</button><button role="tab" aria-selected="${U.view === "handed"}" data-u="view" data-id="handed">Delegiert</button><button role="tab" aria-selected="${U.view === "review"}" data-u="view" data-id="review">Rückblick</button></div>
    ${U.view === "handed" ? delegatedDone() + handedView() : U.view === "review" ? reviewView() : U.view === "all" ? (() => { const saved = U.items.map((x) => [x, x.why]); for (const x of U.items) if (sigBadge(x)) x.why = `${sigBadge(x)} · ${x.why}`; const h = treeView(); for (const [x, w] of saved) x.why = w; return h; })() : U.view === "week" ? weekGrid() : dayView}`;
  return `<div class="frame"><div class="bar"><b>Threva</b><span class="row"><span>Prototyp-Uhr</span><div class="seg" role="tablist" aria-label="Prototyp-Uhr">${[[640, "10:40"], [830, "13:50"], [935, "15:35"]].map(([m, l]) => `<button role="tab" aria-selected="${CAL.now === m}" data-u="clock" data-id="${m}">${l}</button>`).join("")}</div></span></div><div class="body" style="display:flex;flex-direction:column;gap:16px">${body}</div></div>`;
}
function oneAct(a, el) {
  if (a !== "showIn") U.toastActs = [];
  const before = new Set(U.items.map((x) => x.id)), mergeId = U.merge && U.merge.id;
  if (!oneAct0(a, el)) studioAct(a, el);
  const fresh = U.items.filter((x) => !before.has(x.id));
  for (const x of fresh) if (!U.nodes.some((n) => n.id === x.id)) U.nodes.push({ id: x.id, parent: "a-" + x.area, item: true, w: 50 });
  if (fresh.length === 1) { const x = fresh[0]; if (a === "afterKeep") U.toast = ""; else { U.toast = `Notiert unter ${placeOf(x.id)}.`; U.toastActs.unshift(["showIn", x.id, "Ansehen"]); } }
  else if (a === "mergeYes" && mergeId) U.toastActs.push(["showIn", mergeId, "Ansehen"]);
  return true;
}
function placeOf(id) {
  const path = []; let n = U.nodes.find((m) => m.id === id); n = n && U.nodes.find((m) => m.id === n.parent);
  while (n) { path.unshift(n.title || nTitle(n)); n = n.parent ? U.nodes.find((m) => m.id === n.parent) : null; }
  return ["Alles", ...path].join(" › ");
}
function delegatedDone() {
  const done = U.sig.filter((s) => s.st);
  return `<div class="ar"><h3>Von ${esc(A_NAME)} erledigt · ${done.length}</h3><p class="muted" style="max-width:66ch">Was ${esc(A_NAME)} mit Mails, Chats und Einladungen gemacht hat. Jedes lässt sich rückgängig machen.</p>
    ${done.map((s) => `<div class="vrow"><span class="linkq">${esc(s.from)} · ${esc(s.subj)}</span><span class="faint">${OUTCOME[s.st]}${s.auto ? " · nach deiner Regel" : ""}</span><span><button class="btn quiet" data-u="sUndo" data-id="${s.id}">Rückgängig</button></span></div>`).join("") || `<p class="muted">Noch nichts.</p>`}</div>`;
}
/* A6 prototype: why this card comes first. WHY is off, a single line, or the line plus the order with a way to change it. */
let WHY = "off";
function whyFor(e) {
  const [kind, ...r] = e.k.split(":"), id = r.join(":");
  if (kind === "chat") return "";
  if (e.k === U.pin) return "Du hast es selbst geöffnet.";
  if (kind === "soon") { const ev = CAL.day.find((v) => v.id === id); return ev ? `«${ev.t}» beginnt in ${ev.s - CAL.now} Minuten.` : ""; }
  if (kind === "after") return `«${evFind(U.after).t}» ist gerade zu Ende. Jetzt weisst du noch am besten, was daraus folgt.`;
  if (kind === "sg") return "Neu seit gestern und in ein paar Sekunden erledigt.";
  if (kind === "s") { const z = U.sig.find((y) => y.id === id); if (!z) return ""; return z.interrupts ? z.why2.text : z.sug === "attach" ? "Neu seit gestern. Es gehört zu etwas, woran du gerade arbeitest." : z.sug === "draft" ? "Neu seit gestern. Eine Antwort liegt schon bereit." : `Neu seit gestern. ${z.why}`; }
  if (kind === "rt") { const t = U.rt.find((y) => y.id === id); return t && t.pending ? "Die Routine wartet auf deine Freigabe und macht sonst nicht weiter." : "Die Routine ist in der Nacht fehlgeschlagen."; }
  if (kind === "i") { const x = U.items.find((y) => y.id === id); if (!x) return ""; if (x.kind === "Agent is waiting") return "Ein Agent wartet auf deine Entscheidung und macht erst danach weiter."; if (x.proposal) return `${A_NAME} hat heute Nacht einen Vorschlag vorbereitet.`; const g = calGaps()[U.plan[x.id]]; if (g && g.cur) return `Du hast es für jetzt eingeplant, bis ${hm(g.end)}.`; return x.why; }
  if (kind === "dfy") return "Damit du weisst, was ohne dich passiert ist.";
  if (kind === "rev") return "Der Rückblick auf letzte Woche ist noch offen.";
  return "";
}
function whyBlock(e, after) {
  if (WHY === "off" || U.ruleOffer || U.iFeed) return "";
  const w = whyFor(e); if (!w) return "";
  const line = `<div class="whyline"><span><b>Warum jetzt:</b> ${esc(w)}</span>${WHY === "order" ? `<button class="lk" data-u="whyOpen">${U.whyOpen ? "Reihenfolge ausblenden" : "Reihenfolge ansehen"}</button>` : ""}</div>`;
  if (WHY !== "order" || !U.whyOpen) return line;
  return line + `<div class="whypanel"><p class="faint">So sortiert ${esc(A_NAME)}: zuerst Termine, die gleich beginnen oder gerade zu Ende sind. Dann Neues seit gestern, dann was auf dich wartet, dann deine eigene Liste. Was du selbst öffnest, kommt immer zuerst.</p>
    ${after.slice(0, 4).map((x, i) => `<div class="vrow"><span class="linkq">${i + 2}. ${esc(x.title)}</span><span class="faint">${esc(whyFor(x))}</span><span><button class="btn quiet" data-u="pull" data-id="${x.k}">Das zuerst</button></span></div>`).join("")}</div>`;
}
function oneAct0(a, el) {
  const id = el && el.dataset.id;
  if (a === "showIn") { U.view = "all"; U.at = id; U.toast = ""; U.toastActs = []; U.stStack = []; return true; }
  if (a === "whyOpen") { U.whyOpen = !U.whyOpen; return true; }
  if (sigAct(a, el)) return true;
  if (STUDIO_ON && stAct(a, el)) return true;
  if (a === "skip") { U.toast = ""; U.skip = U.skip.filter((k) => k !== id).concat(id); if (U.pin === id) U.pin = null; if (id.startsWith("i:") && U.open === id.slice(2)) U.open = null; return true; }
  if (a === "pull") {
    U.stStack = [];
    U.toast = ""; U.typed = ""; U.view = "day";
    if (id.startsWith("ev:")) { U.ev = id.slice(3); return true; }
    if (id.startsWith("s:")) { const z = U.sig.find((y) => y.id === id.slice(2)); if (z && z.st) { U.inboxOpen = true; return true; } if (z && z.sug === "drop") { U.pin = "sg:" + z.cls; return true; } }
    if (id.startsWith("rto:")) { U.view = "handed"; U.rtOpen = id.slice(4); return true; }
    if (id.startsWith("i:")) { const x = U.items.find((y) => y.id === id.slice(2)); if (x && !x.now) { x.now = true; x.suggest = false; } }
    U.pin = id; U.skip = U.skip.filter((k) => k !== id); return true;
  }
  if (a === "jump") { U.view = "day"; U.pin = "i:" + id; const x = U.items.find((y) => y.id === id); if (x) { x.now = true; if (x.kind !== "Task") U.open = id; } U.skip = U.skip.filter((k) => k !== "i:" + id); U.toast = ""; return true; }
  if (a === "ask") {
    const v = ($("#u-new").value || "").replace(/^\?/, "").trim(); if (!v) return true;
    if (/\b(du|mira)\b.*\b(gemacht|erledigt|getan|gearbeitet|aufgeräumt)\b|\bwas (hast|hat) (du|mira)\b/i.test(v)) { U.chat = { q: v, hits: [], done: true }; U.typed = ""; U.pin = "chat"; U.view = "day"; U.toast = ""; return true; }
    const hits = oneMatches(v).filter((h) => h.k !== "chat");
    const rank = (h) => (h.where === "Jetzt" ? 0 : 1) + (h.k.startsWith("i:") && (U.items.find((y) => y.id === h.k.slice(2)) || {}).proposal ? -1 : 0);
    hits.sort((x, y) => rank(x) - rank(y));
    U.chat = { q: v, hits, turns: [["Du", v], [A_NAME, hits.length ? `Dazu habe ich ${hits.length === 1 ? "einen Eintrag" : `${num(hits.length).toLowerCase()} Einträge`}. Soll ich einen davon hervorholen, oder willst du es zuerst mit mir durchdenken?` : "Dazu habe ich noch nichts. Erzähl mir mehr, dann halte ich fest, was daraus wird."]], hits };
    U.typed = ""; U.pin = "chat"; U.view = "day"; U.toast = ""; return true;
  }
  if (a === "chatPull") { U.chat = null; return oneAct0("pull", el); }
  if (a === "chatKeep") { const v = U.chat.q; U.chat = null; U.items.push({ id: "u" + Date.now(), kind: "Question", now: false, area: "me", model: "cloud", tonight: false, q: v, why: "Aus einem Gespräch mit " + A_NAME + "." }); U.toast = "Notiert."; return true; }
  if (a === "chatEnd") { U.chat = null; U.toast = "Gespräch beendet. Die Zusammenfassung liegt beim Eintrag."; return true; }
  if (a === "add") { U.typed = ""; const inp = $("#u-new"); if (inp) inp.value = inp.value.replace(/^\?\s*/, ""); studioAct("add", el); return true; }
  return false;
}
