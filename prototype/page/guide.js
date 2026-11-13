/* ---------- Guided test run, German and English ---------- */
const L = {
  de: {
    eyebrow: "Threva · Prototyp · alle Daten sind erfunden", title: "Dein Tag an einem Ort",
    thanks: "Danke, dass du das ausprobierst",
    p1: "Threva ist der Entwurf eines Werkzeugs, das dir deinen Tag zeigt: was dich braucht, was im Kalender steht, und was deine persönliche Assistenz für dich vorbereitet oder schon erledigt hat. Der Assistenz gibst du selbst einen Namen.",
    howB: "So läuft es ab:", how: "Du bekommst zehn kurze Aufgaben. Sie stehen oben in einem Balken, der mitwandert. Nach jeder Aufgabe sagst du kurz, wie klar das war. Das dauert etwa 15 Minuten.",
    bullets: ["Nichts hier ist echt. Du kannst nichts kaputt machen.", "Wenn etwas unklar ist, liegt das am Entwurf und nicht an dir. Das wollen wir herausfinden.", "Wenn jemand neben dir sitzt, denk laut.", "Am Schluss schickst du deine Antworten mit einem Klick an das Threva-Team."],
    whichScn: "Welche Situation passt am besten zu dir?", scnAria: "Situation",
    aLabel: "Wie soll deine Assistenz heissen?", aPlaceholder: (n) => `Zum Beispiel ${n}`, ideas: "Ideen:",
    nameLabel: "Dein Vorname (freiwillig)", go: "Los geht's", changeLang: "Switch to English",
    taskOf: (i, n, t) => `Aufgabe ${i} von ${n} · ${t}`, hit: "geschafft",
    howClear: "Wie klar war das?", rate: ["Klar", "Ging so", "Unklar"],
    commentLabel: "Was hat dich gestört, überrascht oder gefreut? (freiwillig)", nextTask: "Nächste Aufgabe", toEnd: "Zum Abschluss", pickFirst: "Wähle zuerst eine der drei Antworten.",
    answerLabel: "Deine Antwort", tip: "Tipp:", btnDone: "Fertig", btnHint: "Tipp zeigen", btnStuck: "Ich komme nicht weiter",
    endQ: "Noch drei Fragen zum Schluss", endDone: "Geschafft. Vielen Dank!",
    endP: "Deine Antworten sind beim Threva-Team angekommen. Hier siehst du, was gesendet wurde.", endDoneMail: "Du hörst von uns, sobald es etwas Neues gibt.", sending: "Wird gesendet …", failTitle: "Das Senden hat nicht geklappt", failP: "Kopiere deine Antworten bitte und schick sie an feedback@threva.work. Du kannst es auch nochmals versuchen.", retry: "Nochmals senden",
    emailLabel: "E-Mail für Neuigkeiten zur Entwicklung (freiwillig)", consent: "Ja, schickt mir Neuigkeiten zur Entwicklung von Threva an diese Adresse.", needConsent: "Setz bitte das Häkchen, wenn du eine Adresse angibst.", badEmail: "Diese Adresse sieht unvollständig aus.",
    privacy: "Gesendet werden deine Antworten, die Zeit pro Aufgabe, die Sprache, die gewählte Situation und die Namen, die du eingegeben hast. Wir verwenden das, um Threva zu verbessern. Deine E-Mail-Adresse verwenden wir nur für Neuigkeiten zur Entwicklung. Wenn du etwas löschen lassen oder keine Neuigkeiten mehr willst, schreib an feedback@threva.work.",
    copy: "Antworten kopieren", copied: "Kopiert", explore: "Frei weiter ausprobieren", restart: "Andere Situation ausprobieren",
    copyFallback: "Wenn das Kopieren nicht klappt, klick in das Feld, markiere alles und kopiere es von Hand.",
    qUnclear: "Was war am unklarsten?", qLiked: "Was hat dir am besten gefallen?", qDaily: "Würdest du so etwas täglich nutzen?", daily: ["Ja", "Vielleicht", "Nein"], qWhy: "Warum?", showAnswers: "Antworten senden",
    steps: ["Erster Eindruck", "Ein Vorschlag deiner Assistenz", "Eine Entscheidung treffen", "Einen Gedanken festhalten", "Den Tag planen", "Für dich erledigt", "Vor einem Termin", "Alles im Überblick", "Etwas regelmässig erledigen lassen", "Wochenrückblick"],
    r: { head: "Threva Probelauf", lang: "Sprache: Deutsch", scn: "Situation", aName: "Assistenz heisst", stuck: "nicht weitergekommen", answered: "beantwortet", done: "geschafft", notSeen: "als fertig gemeldet, aber nicht erkannt", clarity: "Klarheit", tip: "Tipp", yes: "ja", no: "nein", answer: "Antwort", comment: "Kommentar", unclear: "Am unklarsten", liked: "Am besten gefallen", daily: "Täglich nutzen", locale: "de-CH" },
  },
  en: {
    eyebrow: "Threva · prototype · all data is made up", title: "Your day in one place",
    thanks: "Thank you for trying this out",
    p1: "Threva is a draft of a tool that shows you your day: what needs you, what is in your calendar, and what your personal assistant has prepared or already done for you. You give the assistant a name yourself.",
    howB: "How it works:", how: "You get ten short tasks. They sit in a bar at the top that stays with you. After each task you say briefly how clear it was. It takes about 15 minutes.",
    bullets: ["Nothing here is real. You cannot break anything.", "If something is unclear, that is the draft's fault and not yours. That is what we want to find out.", "If someone is sitting next to you, think out loud.", "At the end you send your answers to the Threva team with one click."],
    whichScn: "Which situation fits you best?", scnAria: "Situation",
    aLabel: "What should your assistant be called?", aPlaceholder: (n) => `For example ${n}`, ideas: "Ideas:",
    nameLabel: "Your first name (optional)", go: "Let's go", changeLang: "Auf Deutsch wechseln",
    taskOf: (i, n, t) => `Task ${i} of ${n} · ${t}`, hit: "done",
    howClear: "How clear was that?", rate: ["Clear", "So-so", "Unclear"],
    commentLabel: "What bothered, surprised or pleased you? (optional)", nextTask: "Next task", toEnd: "To the wrap-up", pickFirst: "Pick one of the three answers first.",
    answerLabel: "Your answer", tip: "Tip:", btnDone: "Done", btnHint: "Show a tip", btnStuck: "I am stuck",
    endQ: "Three last questions", endDone: "All done. Thank you!",
    endP: "Your answers have reached the Threva team. Below is what was sent.", endDoneMail: "You will hear from us when there is something new.", sending: "Sending …", failTitle: "Sending did not work", failP: "Please copy your answers and send them to feedback@threva.work. You can also try again.", retry: "Send again",
    emailLabel: "Email for news about development (optional)", consent: "Yes, send me news about the development of Threva at this address.", needConsent: "Please tick the box if you enter an address.", badEmail: "This address looks incomplete.",
    privacy: "What is sent: your answers, the time per task, the language, the situation you chose and the names you entered. We use this to improve Threva. We use your email address only for news about development. To have something deleted or to stop the news, write to feedback@threva.work.",
    copy: "Copy the answers", copied: "Copied", explore: "Keep exploring freely", restart: "Try another situation",
    copyFallback: "If copying does not work, click into the field, select everything and copy it by hand.",
    qUnclear: "What was the least clear?", qLiked: "What did you like best?", qDaily: "Would you use something like this every day?", daily: ["Yes", "Maybe", "No"], qWhy: "Why?", showAnswers: "Send my answers",
    steps: ["First impression", "A suggestion from your assistant", "Making a decision", "Writing down a thought", "Planning the day", "Done for you", "Before a meeting", "Everything at a glance", "Having something done regularly", "Weekly review"],
    r: { head: "Threva test run", lang: "Language: English", scn: "Situation", aName: "Assistant is called", stuck: "got stuck", answered: "answered", done: "done", notSeen: "reported as done, but not detected", clarity: "Clarity", tip: "Tip", yes: "yes", no: "no", answer: "Answer", comment: "Comment", unclear: "Least clear", liked: "Liked best", daily: "Daily use", locale: "en-GB" },
  },
};
const newRun = (lang) => ({ lang: lang || null, stage: lang ? "intro" : "lang", scn: "coach", i: 0, phase: "task", hint: false, acts: {}, res: [], t0: 0, draft: { answer: "", comment: "", rating: null }, end: { unclear: "", liked: "", daily: null, why: "" }, copied: false, aDraft: "", nDraft: "", email: "", consent: false, send: null, err: "" });
let T = newRun();
const STEPS = [
  { id: "first", ask: true }, { id: "suggest", done: (a) => a.yes || a.send }, { id: "decide", done: (a) => a.decide }, { id: "capture", done: (a) => a.mergeYes || a.mergeNo },
  { id: "plan", done: (a) => a.plan && a.later }, { id: "dfy", done: (a) => a.dfyUndo }, { id: "meeting", ask: true, done: (a) => a.clock }, { id: "tree", done: (a) => a.addrow },
  { id: "routine", done: (a) => a.rtMake }, { id: "review", done: (a) => a.revClose },
];
const A_IDEAS = ["Mira", "Nova", "Juno", "Ada", "Theo"];
const CORES = {};
const core = () => (CORES[T.lang] ||= (T.lang === "de" ? coreDE : coreEN)(((lang) => () => T.lang === lang)(T.lang)));
const tx = () => L[T.lang];
const scnOf = (k) => core().SCENARIO_LIST.find((s) => s.key === k);
const act = (a, el) => { T.acts[a] = (T.acts[a] || 0) + 1; return core().studioAct(a, el); };

function langView() {
  return `<div class="frame"><div class="body" style="max-width:60ch">
    <h2>Sprache · Language</h2>
    <p>In welcher Sprache möchtest du den Probelauf machen?<br>Which language would you like to use for the test run?</p>
    <div class="row"><button class="btn pri" data-g="lang" data-v="de" lang="de">Deutsch</button><button class="btn pri" data-g="lang" data-v="en" lang="en">English</button></div></div></div>`;
}
function intro() {
  const t = tx();
  return `<div class="frame"><div class="body" style="max-width:76ch">
    <div class="row" style="justify-content:space-between"><h2>${t.thanks}</h2><button class="btn quiet" data-g="lang" data-v="${T.lang === "de" ? "en" : "de"}">${t.changeLang}</button></div>
    <p>${t.p1}</p>
    <p><b>${t.howB}</b> ${t.how}</p>
    <ul class="plain">${t.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>
    <div class="stack"><p><b>${t.whichScn}</b></p>
      <div class="scn" role="radiogroup" aria-label="${t.scnAria}">${core().SCENARIO_LIST.map((s) => `<button class="card" role="radio" aria-checked="${T.scn === s.key}" data-g="scn" data-v="${s.key}"><span class="q">${esc(s.label)}</span><span class="sub">${esc(s.blurb)}</span></button>`).join("")}</div>
      <p class="muted">${esc(scnOf(T.scn).intro)}</p></div>
    <div class="stack"><label for="g-aname">${t.aLabel}<input type="text" id="g-aname" value="${esc(T.aDraft)}" placeholder="${t.aPlaceholder(A_IDEAS[0])}" style="max-width:280px" autocomplete="off"></label>
      <div class="row"><span class="faint">${t.ideas}</span>${A_IDEAS.map((n) => `<button class="gchip" data-g="aname" data-v="${n}">${n}</button>`).join("")}</div></div>
    <label for="g-name">${t.nameLabel}<input type="text" id="g-name" value="${esc(T.nDraft)}" autocomplete="given-name" style="max-width:280px"></label>
    <div class="row"><button class="btn pri" data-g="start">${t.go}</button></div></div></div>`;
}
function guide() {
  if (T.stage !== "run") return "";
  const t = tx(), s = STEPS[T.i], g = core().PACK.guide[s.id], hit = s.done ? !!s.done(T.acts) : false;
  const head = `<div class="row" style="justify-content:space-between"><span class="eyebrow">${t.taskOf(T.i + 1, STEPS.length, t.steps[T.i])}</span>${hit ? `<span class="pill ok">${t.hit}</span>` : ""}</div>`;
  if (T.phase === "rate") {
    return `<div class="guide">${head}<p><b>${t.howClear}</b></p>
      <div class="seg" role="radiogroup" aria-label="${t.howClear}">${t.rate.map((l, i) => `<button role="radio" aria-checked="${T.draft.rating === i}" data-g="rating" data-v="${i}">${l}</button>`).join("")}</div>
      <label for="g-comment">${t.commentLabel}<textarea id="g-comment">${esc(T.draft.comment)}</textarea></label>
      <div class="row"><button class="btn pri" data-g="next" ${T.draft.rating === null ? "disabled" : ""}>${T.i === STEPS.length - 1 ? t.toEnd : t.nextTask}</button>${T.draft.rating === null ? `<span class="faint">${t.pickFirst}</span>` : ""}</div></div>`;
  }
  return `<div class="guide">${head}<p class="gtask">${esc(g.task)}</p>
    ${s.ask ? `<label for="g-answer">${t.answerLabel}<textarea id="g-answer">${esc(T.draft.answer)}</textarea></label>` : ""}
    ${T.hint && g.hint ? `<p class="muted"><b>${t.tip}</b> ${esc(g.hint)}</p>` : ""}
    <div class="row"><button class="btn pri" data-g="done">${t.btnDone}</button>${g.hint && !T.hint ? `<button class="btn" data-g="hint">${t.btnHint}</button>` : ""}<button class="btn quiet" data-g="stuck">${t.btnStuck}</button></div></div>`;
}
function resultText() {
  const t = tx(), r = t.r;
  const lines = [`${r.head}${T.tName ? " · " + T.tName : ""} · ${new Date().toLocaleDateString(r.locale)}`, `${r.lang} · ${r.scn}: ${scnOf(T.scn).label} · ${r.aName}: ${T.aName}`, ""];
  T.res.forEach((x, n) => {
    lines.push(`${n + 1}. ${t.steps[n]}: ${x.stuck ? r.stuck : x.detected === null ? r.answered : x.detected ? r.done : r.notSeen} · ${r.clarity}: ${t.rate[x.rating]} · ${x.seconds} s · ${r.tip}: ${x.hint ? r.yes : r.no}`);
    if (x.answer) lines.push(`   ${r.answer}: ${x.answer}`);
    if (x.comment) lines.push(`   ${r.comment}: ${x.comment}`);
  });
  lines.push("", `${r.unclear}: ${T.end.unclear || "-"}`, `${r.liked}: ${T.end.liked || "-"}`, `${r.daily}: ${T.end.daily === null ? "-" : t.daily[T.end.daily]}${T.end.why ? " · " + T.end.why : ""}`);
  return lines.join("\n");
}
function endView() {
  const t = tx(), done = T.stage === "sent";
  return `<div class="frame"><div class="body" style="max-width:68ch">
    <h2>${!done ? t.endQ : T.send === "fail" ? t.failTitle : T.send === "sending" ? t.sending : t.endDone}</h2>
    ${done ? `<p>${T.send === "fail" ? t.failP : T.send === "sending" ? "" : t.endP + (T.email ? " " + t.endDoneMail : "")}</p>
      ${T.send === "fail" ? `<div class="row"><button class="btn pri" data-g="resend">${t.retry}</button></div>` : ""}
      <textarea id="g-result" readonly style="min-height:320px;font-family:var(--mono);font-size:12.5px">${esc(resultText())}</textarea>
      <div class="row"><button class="btn pri" data-g="copy">${T.copied ? t.copied : t.copy}</button><button class="btn" data-g="explore">${t.explore}</button><button class="btn quiet" data-g="restart">${t.restart}</button></div>
      <p class="faint">${t.copyFallback}</p>`
    : `<label for="g-unclear">${t.qUnclear}<textarea id="g-unclear">${esc(T.end.unclear)}</textarea></label>
      <label for="g-liked">${t.qLiked}<textarea id="g-liked">${esc(T.end.liked)}</textarea></label>
      <p><b>${t.qDaily}</b></p>
      <div class="seg" role="radiogroup" aria-label="${t.qDaily}">${t.daily.map((v, i) => `<button role="radio" aria-checked="${T.end.daily === i}" data-g="daily" data-v="${i}">${v}</button>`).join("")}</div>
      <label for="g-why">${t.qWhy}<textarea id="g-why">${esc(T.end.why)}</textarea></label>
      <label for="g-email">${t.emailLabel}<input type="email" id="g-email" value="${esc(T.email)}" autocomplete="email" style="max-width:340px"></label>
      <label class="opt" for="g-consent"><input type="checkbox" id="g-consent" ${T.consent ? "checked" : ""}><span>${t.consent}</span></label>
      <input type="text" id="g-web" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">
      ${T.err ? `<p class="pill wait" role="alert" style="align-self:flex-start">${T.err}</p>` : ""}
      <div class="row"><button class="btn pri" data-g="finish">${t.showAnswers}</button></div>
      <p class="faint">${t.privacy}</p>`}</div></div>`;
}
function guideAct(a, el) {
  const s = STEPS[T.i];
  if (a === "lang") { T.lang = el.dataset.v; T.stage = "intro"; }
  else if (a === "scn") T.scn = el.dataset.v;
  else if (a === "aname") T.aDraft = el.dataset.v;
  else if (a === "start") {
    T.aName = T.aDraft.trim().replace(/[<>&"]/g, "").slice(0, 24) || A_IDEAS[0];
    T.tName = T.nDraft.trim().slice(0, 40);
    core().setNames(T.aName, T.tName); core().loadScenario(T.scn); T.stage = "run"; T.t0 = Date.now();
  }
  else if (a === "hint") T.hint = true;
  else if (a === "done" || a === "stuck") { T.phase = "rate"; T.stuck = a === "stuck"; T.seconds = Math.round((Date.now() - T.t0) / 1000); T.detected = s.done ? !!s.done(T.acts) : null; }
  else if (a === "rating") T.draft.rating = Number(el.dataset.v);
  else if (a === "next") {
    if (T.draft.rating === null) return;
    T.res.push({ stuck: T.stuck, detected: T.detected, rating: T.draft.rating, seconds: T.seconds, hint: T.hint, answer: T.draft.answer.trim(), comment: T.draft.comment.trim() });
    T.draft = { answer: "", comment: "", rating: null }; T.hint = false; T.phase = "task"; T.t0 = Date.now();
    if (T.i === STEPS.length - 1) T.stage = "end"; else T.i++;
  }
  else if (a === "daily") T.end.daily = Number(el.dataset.v);
  else if (a === "finish" || a === "resend") {
    if (a === "finish") {
      T.email = ($("#g-email").value || "").trim(); T.consent = !!$("#g-consent").checked; T.hp = $("#g-web").value || "";
      T.err = T.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(T.email) ? tx().badEmail : T.email && !T.consent ? tx().needConsent : "";
      if (T.err) return;
    }
    T.stage = "sent"; T.send = "sending"; sendFeedback();
  }
  else if (a === "explore") T.stage = "free";
  else if (a === "restart") T = Object.assign(newRun(T.lang), { aDraft: T.aName, nDraft: T.tName, scn: T.scn });
  else if (a === "copy") { const txt = resultText(); const sel = () => { const f = $("#g-result"); f.focus(); f.select(); }; try { navigator.clipboard.writeText(txt).then(() => { T.copied = true; render(); }).catch(sel); } catch (e) { sel(); } }
}
function sendFeedback() {
  const body = { lang: T.lang, scenario: T.scn, assistant: T.aName, name: T.tName, email: T.consent ? T.email : "", consent: T.consent && !!T.email, website: T.hp || "", results: T.res, end: T.end, text: resultText() };
  const fin = (ok) => { T.send = ok ? "ok" : "fail"; render(); };
  try { fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => fin(r.ok)).catch(() => fin(false)); } catch (e) { fin(false); }
}
const G_FIELDS = { "g-answer": (v) => (T.draft.answer = v), "g-comment": (v) => (T.draft.comment = v), "g-unclear": (v) => (T.end.unclear = v), "g-liked": (v) => (T.end.liked = v), "g-why": (v) => (T.end.why = v), "g-aname": (v) => (T.aDraft = v), "g-name": (v) => (T.nDraft = v), "g-email": (v) => (T.email = v) };
document.addEventListener("input", (e) => { const f = G_FIELDS[e.target.id]; if (f) f(e.target.value); });

document.addEventListener("change", (e) => { if (e.target.id === "g-consent") T.consent = e.target.checked; });

/* ---------- shell ---------- */
const view = $("#view"), guideEl = $("#guide"), wrapEl = $("#wrap"), hdEyebrow = $("#hd-eyebrow"), hdTitle = $("#hd-title");
function render() {
  const showStudio = T.stage === "run" || T.stage === "free";
  if (T.lang) { wrapEl.lang = T.lang; hdEyebrow.textContent = tx().eyebrow; hdTitle.textContent = tx().title; }
  guideEl.innerHTML = guide();
  guideEl.hidden = T.stage !== "run";
  view.innerHTML = T.stage === "lang" ? langView() : T.stage === "intro" ? intro() : showStudio ? core().studio() : endView();
}
document.addEventListener("click", (e) => {
  const g = e.target.closest("[data-g]"); if (g) { guideAct(g.dataset.g, g); render(); if (["next", "start", "finish", "restart", "lang"].includes(g.dataset.g)) window.scrollTo(0, 0); return; }
  const u = e.target.closest("[data-u]"); if (u && T.lang) { act(u.dataset.u, u); render(); }
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || !T.lang) return;
  const map = { "u-new": "add", "u-add": "addrow", "u-raise": "raise", "u-after": "afterKeep" }, a = map[e.target.id];
  if (a) { act(a); render(); }
});
render();
