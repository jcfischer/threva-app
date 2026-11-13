/* ---------- Guided test, second version: Wissensarbeit only, seven tasks, German ---------- */
/* Built from the feedback on the first version: say up front what the tool is for, fewer and shorter tasks, one card at a time. */
const VERSION = "2";
C.setStudio(true, "rail");
C.setWhy("order");
const TASKS = [
  { t: "Erster Blick", ask: true,
    task: "Schau dir die Seite eine halbe Minute an, ohne etwas anzuklicken. Was würdest du als Erstes tun?" },
  { t: "Die eine Karte", done: (d) => d("afterNone") || d("skip"),
    task: "Die Karte oben ist das, was jetzt dran ist. Erledige sie.",
    hint: "Die Karte fragt, ob es aus dem Stand-up etwas zu notieren gibt. Tipp etwas ein und drück «Notieren». Was du notierst, erscheint auf der Karte. Mit «Fertig» oder Esc ist die Karte erledigt. Wenn es nichts gibt, drück «Nichts zu notieren»." },
  { t: "Der Eingang", done: (d) => d("ruleYes") || d("ruleNo"),
    task: "Seit gestern sind 19 Mails, Chats und Einladungen angekommen. Mira hat sie vorsortiert und schlägt bei jeder Karte etwas vor. Leg die Newsletter weg und sag Mira dann, ob sie das in Zukunft ohne dich machen soll.",
    hint: "Drück bei den Newslettern «Weglegen» oder Enter. Gleich danach fragt Mira, ob sie sich das merken soll. Antworte mit «Ja, als Regel» oder «Weiter fragen»." },
  { t: "Ein Gedanke", done: (d) => d("mergeYes") || d("mergeNo") || (d("add") && !C.U.merge),
    task: "Dir fällt gerade ein: «Kommunikationsleiterin wegen der Presse fragen». Halte das fest, bevor du es wieder vergisst.",
    hint: "Tipp den Satz ins Eingabefeld ganz oben und drück Enter. Nicht ins Feld auf der Karte, das gehört nur zu diesem Termin. Mira schlägt dann vor, wo er hingehört." },
  { t: "Etwas finden", done: (d) => d("pull:i:evening") || d("jump:evening"),
    task: "Du willst nochmals darüber nachdenken, ob du den Abendkurs wieder unterrichtest. Öffne diese Frage.",
    hint: "Tipp «Abendkurs» ins Eingabefeld ganz oben. Darunter erscheint die Frage «Unterrichte ich den Abendkurs im nächsten Semester wieder?». Drück Enter, oder klick darauf. Die Frage erscheint dann als Karte." },
  { t: "Mira fragen", done: (d) => d("chatPull"),
    task: "Du weisst nicht mehr, wo du beim Workshop stehst. Frag Mira danach und öffne, was als Nächstes dran ist.",
    hint: "Frag im Eingabefeld ganz oben einfach in deinen Worten, zum Beispiel «Wie steht es beim Workshop?», und drück Enter. Mira sagt dir, was sie dazu weiss. Bei jedem Eintrag in ihrer Antwort steht «Öffnen». Enter öffnet den ersten." },
  { t: "Eine Frage durchdenken", done: (d) => d("stSpar") && (d("stKeep") || d("stAdopt") || d("stDismiss")),
    task: "Offen ist noch, wer bei der Krisenübung die Presse spielt. Öffne diese Frage. Lass dich von Mira herausfordern und entscheide dann, ob du ihren Vorschlag übernimmst.",
    hint: "Tipp «Krisenübung» ins Eingabefeld ganz oben. Darunter erscheint die Frage «Wie baue ich die Krisenübung für die Geschäftsleitung auf?». Drück Enter, oder klick darauf. Die Frage erscheint als Karte. «Durchdenken» oder noch einmal Enter öffnet sie als Studio. Dort drückst du unter «Mira soll» zum Beispiel «Red Team» und beim Vorschlag für deinen Standpunkt danach «Als Standpunkt übernehmen» oder «Verwerfen». Esc schliesst das Studio wieder." },
  { t: "Mitten im Tag", midday: true, done: (d) => d("iYes") || d("iNo"),
    task: "Es ist 13:50, und um 14:00 beginnt das Kickoff. Gleich kommt eine Mail an. Entscheide, ob du sie sofort ansiehst oder erst nach der Karte, an der du gerade bist. Danach fragt Mira, ob die Unterbrechung richtig war.",
    hint: "Über der Karte erscheint eine Zeile mit der neuen Mail. Enter zeigt sie sofort, Esc nach der aktuellen Karte. Häng sie an das Kickoff an, dann fragt Mira nach." },
  { t: "Zwei Wochen später", later: true, done: (d) => d("sUndo"),
    task: "Zwei Wochen sind vergangen. Mira kennt jetzt deine Regeln und hat heute einiges ohne dich erledigt. Schau nach, was sie gemacht hat, und mach eines davon rückgängig.",
    hint: "Das steht unter dem Reiter «Delegiert» oben, und kurz zusammengefasst auch in der Zeile «Eingang» unter der Karte. Bei einem Eintrag drückst du «Rückgängig»." },
];
const RATE = ["Klar", "Ging so", "Unklar"], DAILY = ["Ja", "Vielleicht", "Nein"];
const newRun = () => ({ stage: "intro", i: 0, phase: "task", hint: false, base: {}, res: [], t0: 0, name: "", draft: { answer: "", comment: "", rating: null }, end: { unclear: "", liked: "", daily: null, why: "" }, email: "", consent: false, hp: "", send: null, err: "", copied: false });
let T = newRun();
const delta = (k) => (ACTS[k] || 0) - (T.base[k] || 0) > 0;
const startTask = () => { const s = TASKS[T.i]; if (s.midday) { C.oneAct("clock", { dataset: { id: "827" } }); const run = T.i; setTimeout(() => { if (T.stage !== "run" || T.i !== run) return; const before = C.U.interrupt; C.oneAct("clock", { dataset: { id: "830" } }); render(); if (C.U.interrupt && C.U.interrupt !== before) chime(); }, 1500); } if (s.later) boot("knowledge", "later"); else if (T.stage === "run" && T.i > 0) Object.assign(C.U, { view: "day", open: null, pin: null, typed: "", ev: null, more: null, inboxOpen: false, toast: "", stStack: [] }); T.base = { ...ACTS }; T.t0 = Date.now(); T.hint = false; };

function introView() {
  return `<div class="frame"><div class="body" style="max-width:70ch;display:flex;flex-direction:column;gap:14px">
    <h2>Worum es geht</h2>
    <p>Bei mir liegen Mails, Chats, Termine, Aufgaben und Ideen an vielen verschiedenen Orten. Ich entscheide dauernd neu, was als Nächstes dran ist, und dabei geht mir regelmässig etwas verloren. Threva ist mein Versuch, das alles an einen Ort zu bringen. Gebaut habe ich es zuerst für mich selbst.</p>
    <p>Eine Assistenz sortiert vor, was hereinkommt. Auf dem Bildschirm steht immer nur eine Sache, nämlich die, die jetzt dran ist. Alles andere findest du über das Eingabefeld ganz oben. Dort notierst du auch Gedanken und stellst der Assistenz Fragen.</p>
    <p>Die erste Version war zu voll, das haben mir viele gesagt. Diese zweite zeigt deutlich weniger, und ich möchte herausfinden, ob man sich darin zurechtfindet.</p>
    <div class="ivy"><span class="from">Deine Rolle</span><p>Für die nächsten zehn Minuten berätst du selbständig Firmen und Gemeinden zur Informationssicherheit, gibst einen Abendkurs und schreibst jede Woche einen Artikel. Es ist Mittwoch, 10:40, und deine Assistenz heisst Mira.</p></div>
    <p class="muted">Es sind neun kurze Aufgaben. Sie stehen oben und bleiben dort, wenn du scrollst. Alle Daten sind erfunden. Wenn du irgendwo hängen bleibst, schreib es mir in den Kommentar, das hilft mir am meisten.</p>
    <label for="g-name">Dein Vorname (freiwillig)<input type="text" id="g-name" value="${esc(T.name)}" autocomplete="given-name" style="max-width:280px"></label>
    <div class="row"><button class="btn pri" data-g="start">Los geht's</button></div></div></div>`;
}
function guideView() {
  if (T.stage !== "run") return "";
  const s = TASKS[T.i], hit = s.done ? s.done(delta) : false;
  const head = `<div class="row" style="justify-content:space-between"><span class="eyebrow">Aufgabe ${T.i + 1} von ${TASKS.length} · ${s.t}</span>${hit ? `<span class="pill ok">geschafft</span>` : ""}</div>`;
  if (T.phase === "rate") return `<div class="guide">${head}${T.auto ? `<p class="gdone">✓ Geschafft, du kannst weiter.</p>` : ""}<p><b>Wie klar war das?</b></p>
    <div class="seg" role="radiogroup" aria-label="Wie klar war das?">${RATE.map((l, i) => `<button role="radio" aria-checked="${T.draft.rating === i}" data-g="rating" data-v="${i}">${l}</button>`).join("")}</div>
    <label for="g-comment">Was ist dir aufgefallen? (freiwillig)<textarea id="g-comment">${esc(T.draft.comment)}</textarea></label>
    <div class="row"><button class="btn pri" data-g="next" ${T.draft.rating === null ? "disabled" : ""}>${T.i === TASKS.length - 1 ? "Zum Abschluss" : "Nächste Aufgabe"}</button></div></div>`;
  return `<div class="guide">${head}<p class="gtask">${esc(s.task)}</p>
    ${s.ask ? `<label for="g-answer">Deine Antwort<textarea id="g-answer">${esc(T.draft.answer)}</textarea></label>` : ""}
    ${T.hint && s.hint ? `<p class="muted"><b>Tipp:</b> ${esc(s.hint)}</p>` : ""}
    <div class="row"><button class="btn pri" data-g="done">Fertig</button>${s.hint && !T.hint ? `<button class="btn" data-g="hint">Tipp zeigen</button>` : ""}<button class="btn quiet" data-g="stuck">Ich komme nicht weiter</button></div></div>`;
}
function resultText() {
  const lines = [`Threva Probelauf ${VERSION}${T.name ? " · " + T.name : ""} · ${new Date().toLocaleDateString("de-CH")}`, "Situation: Wissensarbeit · Assistenz heisst: Mira", ""];
  T.res.forEach((x, n) => {
    lines.push(`${n + 1}. ${TASKS[n].t}: ${x.stuck ? "nicht weitergekommen" : x.detected === null ? "beantwortet" : x.detected ? "geschafft" : "als fertig gemeldet, aber nicht erkannt"} · Klarheit: ${RATE[x.rating]} · ${x.seconds} s · Tipp: ${x.hint ? "ja" : "nein"}`);
    if (x.answer) lines.push(`   Antwort: ${x.answer}`);
    if (x.comment) lines.push(`   Kommentar: ${x.comment}`);
  });
  lines.push("", `Am unklarsten: ${T.end.unclear || "-"}`, `Am besten gefallen: ${T.end.liked || "-"}`, `Täglich nutzen: ${T.end.daily === null ? "-" : DAILY[T.end.daily]}${T.end.why ? " · " + T.end.why : ""}`);
  return lines.join("\n");
}
function endView() {
  if (T.stage === "sent") {
    const title = T.send === "fail" ? "Das Senden hat nicht geklappt" : T.send === "sending" ? "Wird gesendet …" : "Danke dir!";
    const p = T.send === "fail" ? "Kopiere deine Antworten bitte und schick sie an feedback@threva.work. Du kannst es auch nochmals versuchen." : T.send === "sending" ? "" : `Deine Antworten sind bei mir angekommen. Hier siehst du, was ich bekommen habe.${T.email ? " Ich melde mich, wenn es etwas Neues gibt." : ""}`;
    return `<div class="frame"><div class="body" style="max-width:68ch;display:flex;flex-direction:column;gap:12px"><h2>${title}</h2><p>${p}</p>
      ${T.send === "fail" ? `<div class="row"><button class="btn pri" data-g="resend">Nochmals senden</button></div>` : ""}
      <textarea id="g-result" readonly style="min-height:280px;font-family:var(--mono);font-size:12.5px">${esc(resultText())}</textarea>
      <div class="row"><button class="btn pri" data-g="copy">${T.copied ? "Kopiert" : "Antworten kopieren"}</button><button class="btn" data-g="explore">Frei weiter ausprobieren</button></div></div></div>`;
  }
  return `<div class="frame"><div class="body" style="max-width:68ch;display:flex;flex-direction:column;gap:12px"><h2>Noch drei Fragen zum Schluss</h2>
    <label for="g-unclear">Was war am unklarsten?<textarea id="g-unclear">${esc(T.end.unclear)}</textarea></label>
    <label for="g-liked">Was hat dir am besten gefallen?<textarea id="g-liked">${esc(T.end.liked)}</textarea></label>
    <p><b>Würdest du so etwas täglich nutzen?</b></p>
    <div class="seg" role="radiogroup" aria-label="Täglich nutzen" style="align-self:flex-start">${DAILY.map((v, i) => `<button role="radio" aria-checked="${T.end.daily === i}" data-g="daily" data-v="${i}">${v}</button>`).join("")}</div>
    <label for="g-why">Warum?<textarea id="g-why">${esc(T.end.why)}</textarea></label>
    <label for="g-email">Deine E-Mail, falls ich dir schreiben darf, wenn es Neues gibt (freiwillig)<input type="email" id="g-email" value="${esc(T.email)}" autocomplete="email" style="max-width:340px"></label>
    <label class="opt" for="g-consent"><input type="checkbox" id="g-consent" ${T.consent ? "checked" : ""}><span>Ja, du darfst mir an diese Adresse schreiben, wenn es bei Threva etwas Neues gibt.</span></label>
    <input type="text" id="g-web" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">
    ${T.err ? `<p class="pill wait" role="alert" style="align-self:flex-start">${T.err}</p>` : ""}
    <div class="row"><button class="btn pri" data-g="finish">Antworten senden</button></div>
    <p class="faint">Ich bekomme deine Antworten, die Zeit pro Aufgabe und deinen Vornamen, falls du einen angegeben hast. Damit verbessere ich Threva. Deine E-Mail-Adresse brauche ich nur, um dir zu schreiben, wenn es etwas Neues gibt. Wenn ich etwas löschen soll oder du nichts mehr hören willst, schreib an feedback@threva.work.</p></div></div>`;
}
function guideAct(a, el) {
  if (a === "start") { T.name = T.name.trim().slice(0, 40); boot("knowledge", "learn"); T.stage = "run"; startTask(); }
  else if (a === "hint") T.hint = true;
  else if (a === "done" || a === "stuck") { const s = TASKS[T.i]; T.phase = "rate"; T.stuck = a === "stuck"; T.seconds = Math.round((Date.now() - T.t0) / 1000); T.detected = s.done ? s.done(delta) : null; }
  else if (a === "rating") T.draft.rating = Number(el.dataset.v);
  else if (a === "next") {
    if (T.draft.rating === null) return;
    T.res.push({ stuck: T.stuck, detected: T.detected, rating: T.draft.rating, seconds: T.seconds, hint: T.hint, answer: T.draft.answer.trim(), comment: T.draft.comment.trim() });
    T.draft = { answer: "", comment: "", rating: null }; T.phase = "task"; T.auto = false;
    if (T.i === TASKS.length - 1) T.stage = "end"; else { T.i++; startTask(); }
  }
  else if (a === "daily") T.end.daily = Number(el.dataset.v);
  else if (a === "finish" || a === "resend") {
    if (a === "finish") {
      T.email = ($("#g-email").value || "").trim(); T.consent = !!$("#g-consent").checked; T.hp = $("#g-web").value || "";
      T.err = T.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(T.email) ? "Diese Adresse sieht unvollständig aus." : T.email && !T.consent ? "Setz bitte das Häkchen, wenn du eine Adresse angibst." : "";
      if (T.err) return;
    }
    T.stage = "sent"; T.send = "sending"; sendFeedback();
  }
  else if (a === "explore") T.stage = "free";
  else if (a === "copy") { try { navigator.clipboard.writeText(resultText()).then(() => { T.copied = true; render(); }).catch(() => $("#g-result").select()); } catch (e) { $("#g-result").select(); } }
}
function sendFeedback() {
  const body = { version: VERSION, lang: "de", scenario: "knowledge", assistant: "Mira", name: T.name, email: T.consent ? T.email : "", consent: T.consent && !!T.email, website: T.hp, results: T.res, end: T.end, text: resultText() };
  const fin = (ok) => { T.send = ok ? "ok" : "fail"; render(); };
  try { fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => fin(r.ok)).catch(() => fin(false)); } catch (e) { fin(false); }
}
const G_FIELDS = { "g-answer": (v) => (T.draft.answer = v), "g-comment": (v) => (T.draft.comment = v), "g-unclear": (v) => (T.end.unclear = v), "g-liked": (v) => (T.end.liked = v), "g-why": (v) => (T.end.why = v), "g-name": (v) => (T.name = v), "g-email": (v) => (T.email = v) };
document.addEventListener("input", (e) => { const f = G_FIELDS[e.target.id]; if (f) f(e.target.value); });
document.addEventListener("change", (e) => { if (e.target.id === "g-consent") T.consent = e.target.checked; });
document.addEventListener("click", (e) => {
  const g = e.target.closest("[data-g]"); if (!g) return;
  guideAct(g.dataset.g, g); render();
  if (["next", "start", "finish"].includes(g.dataset.g)) window.scrollTo(0, 0);
});
const guideEl = document.getElementById("guide");
/* When the guide sees that a task is done, it says so, plays a short tune and moves on to the rating by itself. */
function success() {
  try {
    AUDIO ||= new (window.AudioContext || window.webkitAudioContext)();
    if (AUDIO.state === "suspended") AUDIO.resume();
    [[660, 0], [880, 0.09], [1320, 0.18]].forEach(([f, d]) => {
      const t = AUDIO.currentTime + d, o = AUDIO.createOscillator(), g = AUDIO.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.1, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g).connect(AUDIO.destination); o.start(t); o.stop(t + 0.24);
    });
  } catch (e) {}
}
function autoDone() {
  if (T.stage !== "run" || T.phase !== "task") return;
  const s = TASKS[T.i]; if (!s.done || !s.done(delta)) return;
  T.phase = "rate"; T.stuck = false; T.detected = true; T.auto = true; T.seconds = Math.round((Date.now() - T.t0) / 1000);
  setTimeout(success, 200);
}
function render() {
  autoDone();
  guideEl.innerHTML = guideView();
  guideEl.hidden = T.stage !== "run";
  view.innerHTML = T.stage === "intro" ? introView() : T.stage === "run" || T.stage === "free" ? C.studioOne() : endView();
}
render();
