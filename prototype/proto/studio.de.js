/* ---------- Prototype: working on one thing. A question opens as a studio in place of the card. ---------- */
/* Model from Cortex docs/desk-studio.md: question, where I stand, the assistant's notes (note, stand, idea, relation) with */
/* keep, dismiss and discuss, material, relations derived from links, and sparring modes. Following a link stacks the next */
/* item on top; Esc goes back one step. STUDIO_ON gates it so the guided test stays unchanged. */
let STUDIO_ON = false, SLAYOUT = "rail";
const SPAR = [["think", "Durchdenken"], ["grill", "Grill mich"], ["other", "Gegenseite"], ["red", "Red Team"], ["first", "Erste Prinzipien"]];
const STUDIO = {
  knowledge: {
    ws: {
      stand: "Mit einem realistischen Vorfall beginnen. Das Krisenhandbuch kommt erst in der Auswertung.",
      people: [["Sara", "Geschäftsleitung, deine Ansprechperson"], ["Nico", "Geschäftsleitung, will kein Stromausfall-Szenario"], ["Kommunikationsleiterin", "wäre am Übungstag frei"]],
      material: [["Mail von Sara, Fr", "Unsere Kommunikationsleiterin wäre am Übungstag frei, falls du sie brauchst."], ["Notizen Vorgespräch, 28. Okt.", "Halber Tag vereinbart. Nico: kein Stromausfall, das hatten sie schon. Zwei halten Übungen für Theater."], ["Krisenhandbuch der Firma, PDF", "42 Seiten, Stand März 2025. Kapitel 3 regelt, wer den Krisenstab einberuft."]],
      events: ["m3"], later: [["Mo 16., 10:00", "Drehbuch der Krisenübung mit Sara"]],
      decisions: [["Keine Offerte mehr ohne Vorgespräch schreiben", "entschieden am 2. September. Die Krisenübung ist das erste Mandat danach."]],
      persona: "Nico",
      notes: [
        { kind: "note", when: "Montag", trigger: "Gespräch mit dir", text: "Ihr habt geklärt: mit einem realistischen Vorfall beginnen, das Krisenhandbuch erst in der Auswertung. Offen ist, wer die Presse spielt.", status: "kept" },
        { kind: "stand", when: "heute 03:12", trigger: "Heute Nacht durchdacht", text: "Ich spiele die Presse selbst, mit einem vorbereiteten Drehbuch. Die Kommunikationsleiterin übt ihre eigene Rolle im Krisenstab.", because: "In einer echten Krise müsste sie der Presse selbst antworten. Wenn sie in der Übung die Presse spielt, übt sie genau das nicht." },
        { kind: "idea", when: "heute 03:14", trigger: "Mail von Sara", text: "Nico bringt den Sicherheitschef mit. Gib ihm eine Rolle im Krisenstab, statt ihn zuschauen zu lassen. Er will wissen, wer im Ernstfall was entscheidet, und das merkt er am besten, wenn er selbst entscheiden muss." },
        { kind: "relation", when: "heute 03:15", trigger: "Gemeinsames Material", relates: "rate", text: "Die Krisenübung dauert einen halben Tag. Wenn sie gut läuft, ist sie dein bestes Argument dafür, den Workshop nur noch ganztägig anzubieten." },
      ],
      spar: {
        think: "Drei Dinge fehlen noch im Ablauf: wer den Vorfall auslöst, wann die Presse zum ersten Mal anruft, und wie du die Geschäftsleitung nach 90 Minuten wieder aus der Übung holst.",
        grill: "Woran merkst du am Ende des halben Tages, dass die Übung etwas gebracht hat? Das solltest du vorher festlegen, sonst weiss es nachher auch die Geschäftsleitung nicht.",
        other: "Fang doch mit dem Krisenhandbuch an. Zwei in der Geschäftsleitung halten Übungen für Theater. Wenn du mit ihrem eigenen Handbuch beginnst, nehmen sie die Übung ernster.",
        red: "Der Vorfall ist zu realistisch. Wenn jemand ihn für einen echten Angriff auf die eigene Firma hält, bricht die Übung in der ersten halben Stunde ab. Plan ein klares Stoppwort ein.",
        first: "Es geht darum, dass sechs Leute unter Zeitdruck gemeinsam entscheiden. Presse, Handbuch und Technik brauchst du nur, damit diese Situation entsteht.",
        persona: "«Bitte kein Stromausfall, das hatten wir schon. Und ich will danach wissen, was wir konkret ändern müssen, nicht nur ein gutes Gefühl haben.»",
      },
    },
  },
};
const SPAR_GENERIC = {
  think: "Was müsste wahr sein, damit du diese Frage heute schliessen kannst? Wenn dir nichts einfällt, fehlt dir wahrscheinlich noch eine Information.",
  grill: "Was passiert, wenn du gar nichts entscheidest? Wenn dann nicht viel passiert, kann die Frage warten.",
  other: "Nimm an, die andere Möglichkeit ist die richtige. Was hättest du dann übersehen?",
  red: "Wo würde dich diese Entscheidung in drei Monaten ärgern?",
  first: "Welche Annahme steckt schon in der Frage selbst?",
};
const KIND_LABEL = { ask: "Deine Frage", answer: "Antwort", note: "Notiz", stand: "Vorschlag für deinen Standpunkt", idea: "Idee", relation: "Bezug", mine: "Deine Idee", spar: "Sparring" };

function stThread(id) {
  U.stT ||= {};
  if (U.stT[id]) return U.stT[id];
  const x = U.items.find((y) => y.id === id), c = (STUDIO[SCN] || {})[id];
  let n = 0;
  const note = (o) => ({ id: id + "-n" + n++, by: A_NAME, status: "open", disc: null, ...o });
  const t = c
    ? { id, stand: c.stand, people: c.people, material: c.material.map(([l, s]) => ({ label: l, text: s })), events: c.events, later: c.later, decisions: c.decisions, persona: c.persona, spar: c.spar, notes: c.notes.map(note) }
    : { id, stand: x.stand || (x.prior && x.prior.after) || "Noch offen.", people: [], material: (x.src || []).map(([l, s]) => ({ label: l, text: s })), events: CAL.day.filter((e) => e.raise.includes(id)).map((e) => e.id), later: [], decisions: [], persona: null, spar: SPAR_GENERIC,
        notes: [x.prior ? note({ kind: "note", when: x.prior.when, trigger: "Gespräch mit dir", text: `Geklärt: ${x.prior.settled.join(" ")}${x.prior.open.length ? ` Offen: ${x.prior.open.join(" ")}` : ""}`, status: "kept" }) : null,
          x.proposal ? note({ kind: "stand", when: "heute 03:12", trigger: "Heute Nacht durchdacht", text: x.proposal, because: x.read || "" }) : null].filter(Boolean) };
  t.note = note; t.matOpen = null; t.busy = null;
  return (U.stT[id] = t);
}
const stTop = () => U.stStack[U.stStack.length - 1];
const stLabel = (e) => e.t === "thread" ? (U.items.find((x) => x.id === e.id) || {}).q || "?" : e.t === "event" ? (CAL.day.find((v) => v.id === e.id) || {}).t || "?" : e.t === "person" ? e.id : e.id;
const stShort = (s) => (s.length > 34 ? s.slice(0, 32) + "…" : s);

function stNote(t, nt) {
  const mine = nt.by === "Du", rel = nt.kind === "relation" && U.items.find((x) => x.id === nt.relates);
  const head = `<span class="row" style="justify-content:space-between"><span class="eyebrow">${KIND_LABEL[nt.kind]} · ${esc(mine ? "du" : nt.by)} · ${esc(nt.when)}${nt.trigger ? ` · ${esc(nt.trigger)}` : ""}</span>${nt.status === "kept" && nt.kind !== "ask" && nt.kind !== "answer" ? `<span class="pill ok">behalten</span>` : nt.status === "dismissed" ? `<span class="pill calm">verworfen</span>` : ""}</span>`;
  const body = `<p>${esc(nt.text)}</p>${nt.because ? `<p class="faint">Warum: ${esc(nt.because)}</p>` : ""}${rel ? `<button class="lk" data-u="stGo" data-id="thread:${rel.id}">${esc(rel.q)}</button>` : ""}`;
  const disc = nt.disc ? `<div class="turns" style="margin-top:4px">${nt.disc.map(([w, s]) => `<div class="turn ${w === "Du" ? "me" : ""}"><b>${esc(w)}</b><div class="say"><p>${esc(s)}</p></div></div>`).join("")}</div>
      <div class="row" style="flex-wrap:nowrap"><input type="text" id="st-say-${nt.id}" placeholder="Deine Antwort an ${esc(A_NAME)}" autocomplete="off"><button class="btn" data-u="stSay" data-id="${nt.id}">Senden</button></div>
      ${nt.kind === "stand" || nt.kind === "idea" ? `<label class="faint" for="st-rw-${nt.id}">Umformuliert<textarea id="st-rw-${nt.id}" style="min-height:48px">${esc(nt.text)}</textarea></label>
      <div class="row"><button class="btn pri" data-u="stAdopt" data-id="${nt.id}" data-to="as">So behalten</button><button class="btn" data-u="stAdopt" data-id="${nt.id}" data-to="rw">Umformuliert behalten</button><button class="btn quiet" data-u="stDismiss" data-id="${nt.id}">Verwerfen</button></div>` : `<div class="row"><button class="btn quiet" data-u="stDiscEnd" data-id="${nt.id}">Gespräch beenden</button></div>`}` : "";
  const acts = nt.status !== "open" || nt.disc ? "" : mine ? `<div class="row"><button class="btn" data-u="stChallenge" data-id="${nt.id}">Herausfordern lassen</button></div>`
    : `<div class="row"><button class="btn pri" data-u="stKeep" data-id="${nt.id}">${nt.kind === "stand" ? "Als Standpunkt übernehmen" : nt.kind === "relation" ? "Bezug behalten" : "Behalten"}</button><button class="btn" data-u="stDisc" data-id="${nt.id}">Besprechen</button><button class="btn quiet" data-u="stDismiss" data-id="${nt.id}">Verwerfen</button></div>`;
  return `<div class="stnote${nt.kind === "stand" ? " stand" : ""}${nt.status === "dismissed" ? " gone" : ""}">${head}${body}${disc}${acts}</div>`;
}
function stRelations(t) {
  const x = U.items.find((y) => y.id === t.id);
  const kept = t.notes.filter((n) => n.kind === "relation" && n.status === "kept").map((n) => n.relates);
  const threads = [...new Set([...kept, ...U.items.filter((y) => y.id !== t.id && y.kind === "Question" && y.area === x.area && !y.who).map((y) => y.id)])].slice(0, 4);
  const grp = (h, rows) => (rows.length ? `<div class="strel"><span class="eyebrow">${h}</span>${rows.join("")}</div>` : "");
  return grp("Fäden", threads.map((id) => { const y = U.items.find((z) => z.id === id); return y ? `<button class="lk" data-u="stGo" data-id="thread:${id}">${esc(y.q)}</button>${kept.includes(id) ? `<span class="faint">von dir verknüpft</span>` : ""}` : ""; }))
    + grp("Demnächst", [...t.events.map((id) => { const ev = CAL.day.find((v) => v.id === id); return ev && ev.e > CAL.now ? `<button class="lk" data-u="stGo" data-id="event:${id}">${esc(ev.t)}, heute ${hm(ev.s)}</button>` : ""; }), ...t.later.map(([w, l]) => `<span>${esc(l)} <span class="faint">${esc(w)}</span></span>`)].filter(Boolean))
    + grp("Leute", t.people.map(([p, r]) => `<span><button class="lk" data-u="stGo" data-id="person:${esc(p)}">${esc(p)}</button> <span class="faint">${esc(r)}</span></span>`))
    + grp("Frühere Entscheidungen", t.decisions.map(([d, w]) => `<span>${esc(d)} <span class="faint">${esc(w)}</span></span>`));
}
function stMaterial(t) {
  return t.material.length ? `<div class="strel"><span class="eyebrow">Material</span>${t.material.map((m, i) => `<button class="lk" data-u="stMat" data-id="${i}" aria-expanded="${t.matOpen === i}">${esc(m.label)}</button>${t.matOpen === i ? `<div class="excerpt"><p>${esc(m.text)}</p></div>` : ""}`).join("")}</div>` : "";
}
function stThreadView(id) {
  const t = stThread(id), x = U.items.find((y) => y.id === id);
  if (!x) return `<p class="muted">Diese Frage ist abgeschlossen.</p>`;
  const spar = `<div class="stspar"><span class="faint">${esc(A_NAME)} soll</span>${SPAR.map(([m, l]) => `<button class="btn" data-u="stSpar" data-id="${m}" ${t.busy ? "disabled" : ""}>${l}</button>`).join("")}${t.persona ? `<button class="btn" data-u="stSpar" data-id="persona" ${t.busy ? "disabled" : ""}>Was würde ${esc(t.persona)} sagen?</button>` : ""}</div>`;
  const main = `<div class="stmain">
    <div class="ststand"><span class="eyebrow">Wo ich stehe</span><p>${esc(t.stand)}</p></div>
    ${spar}
    <div class="row" style="flex-wrap:nowrap"><input type="text" id="st-idea" placeholder="Eine eigene Idee oder eine Frage an ${esc(A_NAME)}" autocomplete="off"><button class="btn" data-u="stIdea">Notieren</button></div>
    <div class="stack" style="gap:10px">${t.busy ? `<div class="stnote thinking"><span class="eyebrow">${esc(A_NAME)} denkt nach · ${esc(t.busy)}</span><p class="faint">Einen Moment …</p></div>` : ""}${t.notes.slice().reverse().map((n) => stNote(t, n)).join("")}</div>
    <div class="row" style="justify-content:space-between"><span class="faint">${t.notes.filter((n) => n.status === "open" && n.by !== "Du").length} offen von ${esc(A_NAME)}</span><span class="row"><button class="btn" data-u="stDone" data-id="decided">Entschieden, abschliessen</button><button class="btn quiet" data-u="stDone" data-id="parked">Parken</button></span></div></div>`;
  const side = `<div class="stside">${stRelations(t)}${stMaterial(t)}</div>`;
  return `<h2 class="stq">${esc(x.q)}</h2>${SLAYOUT === "rail" ? `<div class="stgrid">${main}${side}</div>` : main + `<div class="stbelow">${side}</div>`}`;
}
function stPersonView(name) {
  const hits = oneMatches(name);
  return `<h2 class="stq">${esc(name)}</h2><p class="muted">Alles, was mit ${esc(name)} zu tun hat.</p>
    <div class="stack" style="gap:6px">${hits.map((h) => `<div class="vrow"><span class="linkq">${esc(h.title)}</span><span class="faint">${esc(h.where)}</span><span>${h.k.startsWith("i:") ? `<button class="btn quiet" data-u="stGo" data-id="thread:${h.k.slice(2)}">Öffnen</button>` : ""}</span></div>`).join("") || `<p class="muted">Nichts gefunden.</p>`}</div>`;
}
function studioPage() {
  const top = stTop(), crumbs = U.stStack.map((e, i) => i === U.stStack.length - 1 ? `<b>${esc(stShort(stLabel(e)))}</b>` : `<button class="lk" data-u="stCrumb" data-id="${i}">${esc(stShort(stLabel(e)))}</button>`).join(`<span class="faint">›</span>`);
  const view = top.t === "thread" ? stThreadView(top.id) : top.t === "event" ? (() => { const ev = CAL.day.find((v) => v.id === top.id); return `<h2 class="stq">${esc(ev.t)}, ${hm(ev.s)}</h2>${evDetail(ev)}`; })() : stPersonView(top.id);
  return `<div class="studio card"><div class="row" style="justify-content:space-between"><span class="row stcrumbs"><span class="eyebrow">Studio</span>${crumbs}</span><button class="btn quiet" data-u="stBack">${U.stStack.length > 1 ? "Zurück" : "Schliessen"}</button></div>${view}</div>`;
}
function stFind(id) { for (const t of Object.values(U.stT || {})) { const n = t.notes.find((m) => m.id === id); if (n) return [t, n]; } return [null, null]; }
function stAct(a, el) {
  const id = el && el.dataset && el.dataset.id;
  if (a === "stOpen") { U.stStack = [{ t: "thread", id }]; U.open = null; window.scrollTo(0, 0); return true; }
  if (!U.stStack || !U.stStack.length) return false;
  const top = stTop(), t = top.t === "thread" ? stThread(top.id) : null;
  if (a === "stBack") { U.stStack.pop(); return true; }
  if (a === "stCrumb") { U.stStack = U.stStack.slice(0, Number(id) + 1); return true; }
  if (a === "stGo") { const [k, ...r] = id.split(":"); U.stStack.push({ t: k, id: r.join(":") }); return true; }
  if (a === "stMat") { t.matOpen = t.matOpen === Number(id) ? null : Number(id); return true; }
  if (a === "stKeep" || a === "stDismiss") { const [tt, n] = stFind(id); n.status = a === "stKeep" ? "kept" : "dismissed"; n.disc = null; if (a === "stKeep" && n.kind === "stand") { tt.stand = n.text; U.toast = "Übernommen. Das ist jetzt dein Standpunkt."; } return true; }
  if (a === "stDisc") { const [, n] = stFind(id); n.disc = [[A_NAME, n.kind === "stand" ? "Was passt dir daran nicht, oder was fehlt?" : n.kind === "relation" ? "Siehst du den Zusammenhang anders?" : "Was hältst du davon?"]]; return true; }
  if (a === "stSay") { const [, n] = stFind(id), f = $("#st-say-" + id), v = f && f.value.trim(); if (!v) return true; n.disc.push(["Du", v], [A_NAME, n.kind === "stand" || n.kind === "idea" ? "Willst du es so behalten oder umformulieren?" : "Notiert."]); return true; }
  if (a === "stDiscEnd") { const [, n] = stFind(id); n.disc = null; return true; }
  if (a === "stAdopt") { const [tt, n] = stFind(id); if (el.dataset.to === "rw") { const f = $("#st-rw-" + id); if (f && f.value.trim()) n.text = f.value.trim(); } n.status = "kept"; n.disc = null; if (n.kind === "stand") tt.stand = n.text; U.toast = n.kind === "stand" ? "Übernommen. Das ist jetzt dein Standpunkt." : "Behalten."; return true; }
  if (a === "stIdea") { const f = $("#st-idea"), v = f && f.value.trim(); if (!v) return true; if (isQuestion(v)) { t.notes.push(t.note({ kind: "ask", by: "Du", when: "jetzt", text: v.replace(/^\?\s*/, ""), status: "kept" })); stThink(t, "Antwort", stAnswer(t, v), "answer"); return true; } t.notes.push(t.note({ kind: "mine", by: "Du", when: "jetzt", text: v })); return true; }
  if (a === "stChallenge") { const [tt, n] = stFind(id); n.status = "kept"; stThink(tt, "Herausforderung", `Bei «${stShort(n.text)}» würde ich wissen wollen, wer mitziehen muss, damit es klappt, und ob diese Leute schon davon wissen.`); return true; }
  if (a === "stSpar") { const label = id === "persona" ? `Was würde ${t.persona} sagen?` : SPAR.find(([m]) => m === id)[1]; stThink(t, label, t.spar[id]); return true; }
  if (a === "stDone") { const x = U.items.find((y) => y.id === top.id); if (id === "decided") { U.log.push(`${x.q}: ${t.stand}`); U.items = U.items.filter((y) => y !== x); U.toast = "Abgeschlossen. Dein Standpunkt ist als Entscheidung notiert."; } else { x.now = false; U.toast = "Geparkt. Du findest die Frage unter Alles und über das Eingabefeld ganz oben."; } U.stStack = []; return true; }
  return false;
}
function stThink(t, label, text, kind) {
  t.busy = label;
  setTimeout(() => { t.busy = null; t.notes.push(t.note({ kind: kind || "spar", when: "jetzt", trigger: kind === "answer" ? "" : label, text, status: kind === "answer" ? "kept" : "open" })); render(); blip(false); }, 1200);
}
/* Mira answers from what the thread holds: the stand, her notes and the material. Best keyword match wins. */
function stAnswer(t, q) {
  const all = q.toLowerCase().split(/[^a-zäöüéèàç0-9]+/).filter((w) => w.length >= 3 && !Q_STOP.has(w)).map(qStem);
  const noteSrc = (n) => (n.kind === "stand" ? `In meinem Vorschlag von ${n.when}` : n.kind === "idea" ? `In meiner Idee von ${n.when}` : n.kind === "relation" ? "In meinem Hinweis auf einen Bezug" : `In meiner Notiz von ${n.when}`);
  const pool = [...t.notes.filter((n) => n.by !== "Du" && n.kind !== "answer" && n.status !== "dismissed").reverse().map((n) => [noteSrc(n), n.text]), ["In deinem Standpunkt", t.stand], ...t.material.map((m) => [`In «${m.label}»`, m.text]), ...t.people.map(([p, r]) => [`Zu ${p}`, `${p}: ${r}`])];
  const best = pool.map(([src, text]) => ({ src, text, n: all.filter((w) => text.toLowerCase().includes(w)).length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n)[0];
  return best ? `${best.src} steht: «${best.text}»` : `In diesem Faden steht dazu noch nichts. Mit «Durchdenken» überlege ich es mir genauer.`;
}
