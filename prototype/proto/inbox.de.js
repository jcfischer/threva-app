/* ---------- Prototype: arrivals as signals. Mail, chat and invitations are sorted before anything reaches the list. ---------- */
/* Four outcomes per signal: let go, attach to an item, draft a reply, or ask. In the learning phase every signal asks; */
/* answering a class the same way offers a rule. After two weeks the rules run and only drafts and real questions reach the card. */
let PHASE = "learn";
const CLS = { news: "Newsletter", notif: "Benachrichtigungen", pr: "Pressemitteilungen", receipt: "Bestätigungen" };
const CLS1 = { news: "Newsletter", notif: "Benachrichtigung", pr: "Pressemitteilung", receipt: "Bestätigung" };
const clsN = (cls, n) => (n === 1 ? CLS1[cls] : CLS[cls]);
const sg = (id, ch, from, subj, gist, o) => ({ id, ch, from, subj, gist, ...o });
const SIG = {
  knowledge: [
    sg("s1", "Mail", "heise Security", "Wochenrückblick KW 46", "Zwölf Meldungen der Woche, keine nennt Produkte deiner Mandate.", { cls: "news", sug: "drop" }),
    sg("s2", "Mail", "SANS NewsBites", "Volume XXVIII, Issue 89", "Sammlung von Sicherheitsmeldungen aus den USA.", { cls: "news", sug: "drop" }),
    sg("s3", "Mail", "Digital Society Newsletter", "Veranstaltungen im Dezember", "Fünf Anlässe, keiner an einem freien Abend.", { cls: "news", sug: "drop" }),
    sg("s4", "Mail", "LinkedIn", "Du wurdest diese Woche in 7 Suchen gefunden", "Automatische Benachrichtigung.", { cls: "notif", sug: "drop" }),
    sg("s5", "Mail", "Doodle", "Erinnerung: Umfrage Netzwerktreffen", "Du hast schon abgestimmt.", { cls: "notif", sug: "drop" }),
    sg("s6", "Mail", "Pressestelle Firewall AG", "Pressemitteilung: neue Firewall-Serie", "Produktankündigung, ohne Bezug zu deinen Mandaten.", { cls: "pr", sug: "drop" }),
    sg("s7", "Mail", "Agentur Kommunikation+", "Einladung zum Launch-Event am 3. Dezember", "Medienanlass eines Herstellers.", { cls: "pr", sug: "drop" }),
    sg("s8", "Mail", "Buchhaltung Gemeinde", "Rechnung 2026-031 erhalten", "Zahlung bis 30. November bestätigt.", { cls: "receipt", sug: "drop" }),
    sg("a1", "Mail", "Sara, Geschäftsleitung", "Re: Kickoff, schaut der Verwaltungsrat zu?", "Der Verwaltungsrat würde gern zuschauen. Ist das für die Übung ein Problem?", { sug: "attach", to: "ws" }),
    sg("a2", "Mail", "Lea, Gemeindeprojekt", "Zwei-Faktor: neuer Termin bestätigt", "Der Lieferant bestätigt den 27. November.", { sug: "attach", to: "inv" }),
    sg("a3", "Chat", "Tim, Gemeindeprojekt", "Hast du die Folien für Donnerstag?", "Er möchte sie vorher kurz durchsehen.", { sug: "attach", to: "print" }),
    sg("a4", "Mail", "Keller AG", "Anfrage: Workshop im Februar", "Die dritte Firma, die diese Woche nach dem Workshop fragt. Sie nennt keine Dauer.", { sug: "attach", to: "rate" }),
    sg("a5", "Mail", "Kurssekretariat", "Prüfungstermine Januar", "Drei mögliche Daten, Antwort bis 25. November.", { sug: "attach", to: "room" }),
    sg("a6", "Mail", "Zahnarztpraxis", "Erinnerung: Kontrolle fällig", "Online-Buchung ist offen.", { sug: "attach", to: "walk" }),
    sg("d1", "Mail", "Nina, Abendkurs", "Kann ich die Prüfung später schreiben?", "Sie ist am Prüfungstag im Ausland.", { sug: "draft", draft: "Hallo Nina, ein Nachholtermin ist möglich. Das Kurssekretariat legt ihn im Januar fest und meldet sich bei dir. Gruss" }),
    sg("d2", "Kalender", "Nico, Geschäftsleitung", "Verschoben: Drehbuch Krisenübung, Mo 10:00 auf 11:00", "Montag 11:00 ist in deinem Kalender frei.", { sug: "draft", draft: "Zusagen. Der Termin wird in deinem Kalender auf 11:00 verschoben." }),
    sg("q1", "Mail", "Gemeinde Wil", "Anfrage: Informationssicherheits-Check", "Eine Gemeinde, mit der du noch nie gearbeitet hast, fragt nach einem Angebot bis Ende Januar.", { sug: "ask", area: "clients", why: "Das passt zu keinem Eintrag. Es wäre ein neues Mandat." }),
    sg("q2", "Mail", "Konferenz Sicherheit Ost", "Speaker-Info: Folien bis 20. November", "Dein Vortrag ist am 4. Dezember. Folien bitte bis 20. November hochladen.", { sug: "ask", area: "business", why: "Eine Frist, die noch nirgends steht." }),
    sg("q3", "Chat", "Mara", "Morgen Mittag statt heute?", "Sie schafft es heute nicht vor 13:00.", { sug: "ask", area: "me", why: "Betrifft deinen Kalender von heute und morgen." }),
  ],
};
/* Arrivals during the day. sigTick() lets every one whose time has come arrive when the clock moves. */
const LIVE = {
  knowledge: [
    sg("l1", "Mail", "Sara, Geschäftsleitung", "Kickoff: Der Verwaltungsrat kommt nicht", "Der Verwaltungsrat sagt ab. Dafür bringt Nico den Sicherheitschef mit. Der will vor allem wissen, wer im Ernstfall was entscheidet.", { at: 828, sug: "attach", toEv: "m3" }),
    sg("l2", "Mail", "Doodle", "Neue Umfrage: Weihnachtsessen Netzwerk", "Automatische Einladung zu einer Umfrage.", { at: 829, cls: "notif", sug: "drop" }),
    sg("l3", "Mail", "Kurssekretariat", "Heute bis 18:00: Notenliste bestätigen", "Die Noten der Zwischenprüfung gehen morgen früh an die Studierenden. Bitte die Liste bis heute 18:00 bestätigen.", { at: 870, due: "today", sug: "ask", area: "business", why: "Eine Frist von heute, die noch nirgends steht." }),
  ],
};
/* O6: Mira interrupts only for mail about a meeting today, a deadline today, or from someone on your list. You can switch each reason off. */
function sigWhy(s) {
  const ev = s.toEv && CAL.day.find((e) => e.id === s.toEv);
  if (ev && ev.e > CAL.now && U.irule.meeting !== false) return { key: "meeting", text: `Betrifft «${ev.t}» um ${hm(ev.s)}.` };
  if (s.due === "today" && U.irule.due !== false) return { key: "due", text: "Hat eine Frist von heute." };
  const v = U.vip.find((n) => s.from.startsWith(n));
  if (v && U.irule["vip:" + v] !== false) return { key: "vip:" + v, text: `Von ${v}, die auf deiner Liste steht.` };
  return null;
}
const IRULE = { meeting: "Mails zu Terminen von heute", due: "Mails mit einer Frist von heute" };
const inMeeting = (z) => CAL.day.find((e) => e.s <= CAL.now && CAL.now < e.e && e.id !== z.toEv);
function sigTick() {
  for (const s of LIVE[SCN] || []) {
    if (s.at > CAL.now || U.sig.some((z) => z.id === s.id)) continue;
    const z = { ...s, st: null, auto: false, manual: false, live: true };
    U.sig.push(z);
    if (z.sug === "drop" && U.rules[z.cls]) { sigResolve(z, "drop", true); continue; }
    const why = sigWhy(z); if (!why) continue;
    const during = CAL.day.find((e) => e.s <= z.at && z.at < e.e && e.id !== z.toEv);
    z.why2 = why; z.interrupts = true;
    if (during) z.heldNote = `Kam um ${hm(z.at)} während «${during.t}». ${A_NAME} hat bis nach dem Termin gewartet.`;
    U.iq.push(z.id);
  }
  sigRelease();
}
function sigRelease() {
  if (U.interrupt) { const z = U.sig.find((y) => y.id === U.interrupt); if (z && z.st === null) return; U.interrupt = null; }
  const nid = U.iq.find((id) => { const z = U.sig.find((y) => y.id === id); return z && z.st === null && !inMeeting(z); });
  if (nid) { U.interrupt = nid; U.iq = U.iq.filter((i) => i !== nid); }
}
function interruptBox() {
  const z = U.interrupt && U.sig.find((y) => y.id === U.interrupt); if (!z || z.st !== null) return "";
  return `<div class="interrupt"><span class="eyebrow">Gerade angekommen · ${esc(z.ch)} von ${esc(z.from)}</span><b>${esc(z.subj)}</b><span class="faint">${esc(z.heldNote || z.why2.text)}</span>
    <div class="row"><button class="btn pri" data-u="iNow">Jetzt ansehen</button><button class="btn" data-u="iLater">Nach dieser Karte</button>${keyHint(cardKeys(null))}</div></div>`;
}
function iFeedBox() {
  const z = U.iFeed && U.sig.find((y) => y.id === U.iFeed); if (!z) return "";
  return `<div class="ivy"><span class="from">Kurze Frage</span><p>War die Mail von ${esc(z.from)} wichtig genug, um dich zu unterbrechen?</p><div class="row"><button class="btn pri" data-u="iYes">Ja</button><button class="btn quiet" data-u="iNo">Nein, das hätte warten können</button>${keyHint(cardKeys(null))}</div></div>`;
}
const sigNoun = { Mail: ["Mail", "Mails"], Chat: ["Chat", "Chats"], Kalender: ["Einladung", "Einladungen"] };
function sigInit() {
  U.sig = (SIG[SCN] || []).map((s) => ({ ...s, st: null, auto: false, manual: false }));
  U.rules = PHASE === "later" ? { news: true, notif: true, pr: true, receipt: true, attach: true } : {};
  U.ruleOffer = null; U.inboxOpen = false; U.attachCount = 0;
  U.vip = ["Sara"]; U.irule = {}; U.iq = []; U.interrupt = null; U.iFeed = null; U.nextUp = null; U.nextBehind = null;
  sigApplyRules();
}
function sigApplyRules() {
  for (const s of U.sig.filter((s) => s.st === null && !s.manual && !s.interrupts)) {
    if (s.sug === "drop" && U.rules[s.cls]) sigResolve(s, "drop", true);
    else if (s.sug === "attach" && U.rules.attach) sigResolve(s, "attach", true);
  }
}
function sigResolve(s, how, auto) {
  s.st = how; s.auto = !!auto;
  if (s.interrupts && !auto) { U.iFeed = s.id; if (U.interrupt === s.id) U.interrupt = null; }
  if (how === "attach" && s.toEv) { const ev = CAL.day.find((e) => e.id === s.toEv); ev.notes.push(`${s.from}: ${s.gist}`); return; }
  if (how === "attach") {
    const it = U.items.find((x) => x.id === s.to); if (!it) { s.st = null; return; }
    it.src = (it.src || []).concat([[`${s.ch} von ${s.from}`, s.gist]]);
    (it.sig ||= []).push(s.id);
    if (!it.read) it.read = s.gist;
  }
  if (how === "keep") {
    const nid = "k" + s.id;
    U.items.push({ id: nid, kind: s.ch === "Mail" ? "Mail" : "Question", now: false, area: s.area || "me", model: "cloud", tonight: false, q: s.subj, why: `${s.ch} von ${s.from}. ${s.gist}`, src: [[`${s.ch} von ${s.from}`, s.gist]], sig: [s.id] });
    U.nodes.push({ id: nid, parent: "a-" + (s.area || "me"), item: true, w: 50 });
  }
}
function sigUndo(s) {
  if (s.st === "attach" && s.toEv) { const ev = CAL.day.find((e) => e.id === s.toEv); ev.notes = ev.notes.filter((n) => n !== `${s.from}: ${s.gist}`); }
  else if (s.st === "attach") { const it = U.items.find((x) => x.id === s.to); if (it) { it.src = it.src.filter(([k]) => k !== `${s.ch} von ${s.from}`); it.sig = it.sig.filter((i) => i !== s.id); } }
  if (s.st === "keep") { U.items = U.items.filter((x) => x.id !== "k" + s.id); U.nodes = U.nodes.filter((n) => n.id !== "k" + s.id); }
  s.st = null; s.auto = false; s.manual = true;
}
/* Badge for an item: which channels fed it, e.g. "2 Mails · 1 Chat". */
function sigBadge(it) {
  if (!it.sig || !it.sig.length) return "";
  const n = {}; for (const id of it.sig) { const s = U.sig.find((x) => x.id === id); if (s) n[s.ch] = (n[s.ch] || 0) + 1; }
  return Object.entries(n).map(([ch, c]) => `${c} ${sigNoun[ch][c === 1 ? 0 : 1]}`).join(" · ");
}
function sigEntries() {
  const open = U.sig.filter((s) => s.st === null), out = [];
  for (const cls of Object.keys(CLS)) {
    const g = open.filter((s) => s.sug === "drop" && s.cls === cls); if (!g.length) continue;
    out.push({ k: "sg:" + cls, title: `${g.length} ${clsN(cls, g.length)} weglegen?`, html: () => sigGroupCard(cls, g) });
  }
  for (const s of open.filter((s) => s.sug !== "drop")) out.push({ k: "s:" + s.id, title: `${s.ch} von ${s.from}: ${s.subj}`, html: () => sigCard(s) });
  return out;
}
const sigHead = (s, extra) => `<span class="row" style="justify-content:space-between"><span class="eyebrow">Eingang · ${esc(s.ch)} · ${esc(s.from)}</span>${extra || ""}</span>`;
function sigGroupCard(cls, g) {
  return `<div class="card"><span class="row" style="justify-content:space-between"><span class="eyebrow">Eingang · ${g.length} ${clsN(cls, g.length)}</span></span>
    <span class="q">${g.length === 1 ? "Weglegen?" : `Alle ${g.length} weglegen?`}</span>
    <ul class="plain">${g.map((s) => `<li><b>${esc(s.from)}</b> <span class="faint">${esc(s.subj)}</span></li>`).join("")}</ul>
    <div class="ivy"><span class="from">${esc(A_NAME)} würde das weglegen</span><p>${cls === "receipt" ? "Eine Bestätigung ohne Frage an dich. Sie bleibt im Mail-Archiv." : "Nichts davon betrifft einen deiner Einträge oder Termine. Weggelegt heisst archiviert, nicht gelöscht."}</p></div>
    <div class="row"><button class="btn pri" data-u="sgDrop" data-id="${cls}">Weglegen</button><button class="btn" data-u="sgLeave" data-id="${cls}">Im Mail lassen</button></div></div>`;
}
function sigCard(s) {
  const it = s.to && U.items.find((x) => x.id === s.to), ev = s.toEv && CAL.day.find((e) => e.id === s.toEv);
  const body = `<span class="q">${esc(s.subj)}</span><span class="sub">${esc(s.gist)}</span>`;
  if (s.sug === "attach") return `<div class="card">${sigHead(s)}${body}
    <div class="ivy"><span class="from">${esc(A_NAME)} würde das anhängen an</span><p><b>${esc(ev ? `die Vorbereitung für «${ev.t}» um ${hm(ev.s)}` : it ? it.q : "?")}</b></p></div>
    <div class="row"><button class="btn pri" data-u="sAttach" data-id="${s.id}">Anhängen</button><button class="btn" data-u="sKeep" data-id="${s.id}">Eigener Eintrag</button><button class="btn quiet" data-u="sDrop" data-id="${s.id}">Weglegen</button></div></div>`;
  if (s.sug === "draft") return `<div class="card">${sigHead(s, `<span class="pill think">Antwort liegt bereit</span>`)}${body}
    <div class="ivy"><span class="from">Entwurf von ${esc(A_NAME)}</span><p>${esc(s.draft)}</p></div>
    <div class="row"><button class="btn pri" data-u="sSend" data-id="${s.id}">${s.ch === "Kalender" ? "Zusagen" : "Senden"}</button><button class="btn" data-u="sSelf" data-id="${s.id}">Selbst antworten</button><button class="btn quiet" data-u="sDrop" data-id="${s.id}">Weglegen</button></div></div>`;
  return `<div class="card">${sigHead(s, `<span class="pill wait">Neu</span>`)}${body}
    <div class="ivy"><span class="from">${esc(A_NAME)} fragt dich</span><p>${esc(s.why)}</p></div>
    <div class="row"><button class="btn pri" data-u="sKeep" data-id="${s.id}">Behalten</button><button class="btn quiet" data-u="sDrop" data-id="${s.id}">Weglegen</button></div></div>`;
}
const OUTCOME = { drop: "weggelegt", attach: "angehängt", keep: "behalten", sent: "beantwortet", self: "beantwortest du selbst", left: "im Mail gelassen" };
function sigLine() {
  const done = U.sig.filter((s) => s.st); if (!U.sig.length) return "";
  const n = {}; for (const s of done) n[s.st] = (n[s.st] || 0) + 1;
  const auto = done.filter((s) => s.auto).length, open = U.sig.length - done.length;
  const rules = Object.keys(U.rules).filter((k) => U.rules[k]);
  const head = `<div class="nextline"><span class="eyebrow">Eingang</span><span class="faint">${U.sig.length} angekommen${open ? `, ${open} offen` : ""}${done.length ? ` · ${Object.entries(n).map(([k, c]) => `${c} ${OUTCOME[k]}`).join(" · ")}` : ""}${auto ? ` · ${auto} davon nach deinen Regeln` : ""}</span>${done.length ? `<button class="lk" data-u="inbox">${U.inboxOpen ? "Weniger" : "Ansehen"}</button>` : ""}</div>`;
  if (!U.inboxOpen) return head;
  return head + `<div class="stack" style="gap:2px">${done.map((s) => `<div class="vrow"><span class="linkq">${esc(s.from)} · ${esc(s.subj)}</span><span class="faint">${OUTCOME[s.st]}${s.st === "attach" ? ` an ${esc(s.toEv ? (CAL.day.find((e) => e.id === s.toEv) || {}).t || "" : (U.items.find((x) => x.id === s.to) || {}).q || "")}` : ""}${s.auto ? " · nach Regel" : ""}</span><span><button class="btn quiet" data-u="sUndo" data-id="${s.id}">Rückgängig</button></span></div>`).join("")}
    ${rules.length ? `<span class="eyebrow" style="margin-top:8px">Deine Regeln</span>${rules.map((k) => `<div class="vrow"><span>${k === "attach" ? "Was klar zu einem Eintrag passt, ohne Fragen anhängen" : `${CLS[k]} ohne Fragen weglegen`}</span><span></span><span><button class="btn quiet" data-u="ruleDel" data-id="${k}">Regel löschen</button></span></div>`).join("")}` : ""}
    <span class="eyebrow" style="margin-top:8px">Darf dich unterbrechen</span>${[...Object.keys(IRULE), ...U.vip.map((v) => "vip:" + v)].map((k) => `<div class="vrow"><span>${k.startsWith("vip:") ? `Mails von ${esc(k.slice(4))}` : IRULE[k]}</span><span class="faint">${U.irule[k] === false ? "aus" : "an"}</span><span><button class="btn quiet" data-u="iToggle" data-id="${k}">${U.irule[k] === false ? "Einschalten" : "Ausschalten"}</button></span></div>`).join("")}</div>`;
}
function ruleOfferBox() {
  const o = U.ruleOffer; if (!o) return "";
  return `<div class="ivy"><span class="from">Soll ich mir das merken?</span><p>${esc(o.text)}</p><div class="row"><button class="btn pri" data-u="ruleYes">Ja, als Regel</button><button class="btn quiet" data-u="ruleNo">Weiter fragen</button>${keyHint(cardKeys(null))}</div></div>`;
}
function sigAct(a, el) {
  const id = el && el.dataset.id, s = U.sig && U.sig.find((x) => x.id === id);
  const fin = (how, msg) => { sigResolve(s, how, false); U.toast = msg; };
  if (a === "sgDrop" || a === "sgLeave") {
    const g = U.sig.filter((x) => x.st === null && x.sug === "drop" && x.cls === id);
    for (const x of g) sigResolve(x, a === "sgDrop" ? "drop" : "left", false);
    U.toast = a === "sgDrop" ? `${g.length} ${clsN(id, g.length)} weggelegt.` : "Bleibt im Mail. Threva zeigt es nicht mehr.";
    U.lastUndo = g.map((x) => x.id); (U.toastActs ||= []).push(["undoLast", "", "Rückgängig"]);
    if (a === "sgDrop" && PHASE === "learn" && !U.rules[id]) U.ruleOffer = { key: id, text: `${CLS[id]} künftig ohne Fragen weglegen? Du siehst sie dann nur noch hier unter Eingang, mit Rückgängig.` };
    return true;
  }
  if (a === "sAttach") { const tgt = s.toEv ? (CAL.day.find((e) => e.id === s.toEv) || {}).t : (U.items.find((x) => x.id === s.to) || {}).q; fin("attach", `Angehängt an «${tgt}».`); U.lastUndo = [s.id]; (U.toastActs ||= []).push(["showSig", s.id, "Ansehen"], ["undoLast", "", "Rückgängig"]); U.attachCount++; if (PHASE === "learn" && U.attachCount === 2 && !U.rules.attach) U.ruleOffer = { key: "attach", text: "Was klar zu einem Eintrag passt, künftig ohne Fragen anhängen? Du siehst es beim Eintrag und unter Eingang." }; return true; }
  if (a === "sKeep") { fin("keep", "Behalten."); U.lastUndo = [s.id]; (U.toastActs ||= []).push(["undoLast", "", "Rückgängig"]); return true; }
  if (a === "sDrop") { fin("drop", "Weggelegt."); U.lastUndo = [s.id]; (U.toastActs ||= []).push(["undoLast", "", "Rückgängig"]); return true; }
  if (a === "sSend") { fin("sent", s.ch === "Kalender" ? "Zugesagt. Der Termin ist verschoben." : "Gesendet."); return true; }
  if (a === "sSelf") { fin("self", "Das Mail ist in deinem Mailprogramm geöffnet."); return true; }
  if (a === "undoLast") { const ids = U.lastUndo || []; if (!ids.length) { U.toast = "Nichts zum Rückgängigmachen."; return true; } for (const i of ids) { const z = U.sig.find((y) => y.id === i); if (z && z.st) sigUndo(z); } U.lastUndo = null; U.ruleOffer = null; U.iFeed = null; U.view = "day"; U.toast = "Rückgängig gemacht. Es ist wieder offen."; return true; }
  if (a === "showSig") { if (s.toEv) { U.view = "day"; U.ev = s.toEv; U.toast = ""; } else { U.view = "all"; U.at = s.to; U.toast = ""; } return true; }
  if (a === "sUndo") { sigUndo(s); U.pin = s.sug === "drop" ? "sg:" + s.cls : "s:" + s.id; U.view = "day"; U.toast = "Rückgängig. Es ist wieder offen."; return true; }
  if (a === "inbox") { U.inboxOpen = !U.inboxOpen; return true; }
  if (a === "clock") { CAL.now = Number(id); U.open = null; sigTick(); return true; }
  if (a === "iNow") { const k = "s:" + U.interrupt; U.pin = k; U.skip = U.skip.filter((x) => x !== k); U.interrupt = null; U.view = "day"; U.toast = ""; sigRelease(); return true; }
  if (a === "iLater") { const q = oneQueue(); U.nextUp = "s:" + U.interrupt; U.nextBehind = q[0] ? q[0].k : null; U.interrupt = null; U.toast = "Kommt nach dieser Karte."; sigRelease(); return true; }
  if (a === "iYes") { U.iFeed = null; U.toast = "Gut, dann bleibt das so."; sigRelease(); return true; }
  if (a === "iNo") { const z = U.sig.find((y) => y.id === U.iFeed); if (z) U.irule[z.why2.key] = false; U.iFeed = null; U.toast = "Gemerkt. Solche Mails kommen künftig ohne Unterbrechung in die Liste. Du kannst das unter Eingang wieder einschalten."; sigRelease(); return true; }
  if (a === "iToggle") { U.irule[id] = U.irule[id] === false ? true : false; return true; }
  if (a === "ruleYes") { U.rules[U.ruleOffer.key] = true; U.ruleOffer = null; sigApplyRules(); U.toast = "Gemerkt. Die Regel steht unter Eingang und lässt sich dort löschen."; return true; }
  if (a === "ruleNo") { U.ruleOffer = null; return true; }
  if (a === "ruleDel") { delete U.rules[id]; U.toast = "Regel gelöscht. Ab jetzt fragt " + A_NAME + " wieder."; return true; }
  return false;
}
