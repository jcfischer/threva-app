/* ---------- Client shell shared by the explore page and the guided test ---------- */
/* The page defines render(). Every action goes through act(), which counts it in ACTS (also as "action:id") for the guide. */
const C = oneCore();
const view = document.getElementById("view");
const ACTS = {};
function boot(key, phase) {
  if (phase) C.setPhase(phase);
  C.loadScenario(key);
  Object.assign(C.U, { skip: [], pin: null, typed: "", chat: null, open: null, stStack: [], stT: null });
  C.sigInit();
}
/* A short tone as feedback that an action happened: rising for doing, falling for declining or stepping back. Synthesized, no audio files. */
let AUDIO = null;
const BACK = new Set(["skip", "sgLeave", "afterNone", "ruleNo", "rtSkip", "rtAck", "revLater", "chatEnd", "sUndo", "mergeNo", "dfyUndo", "unplan", "cancel", "notquite"]);
function blip(back) {
  try {
    AUDIO ||= new (window.AudioContext || window.webkitAudioContext)();
    if (AUDIO.state === "suspended") AUDIO.resume();
    const t = AUDIO.currentTime, o = AUDIO.createOscillator(), g = AUDIO.createGain();
    const [f1, f2] = back ? [540, 360] : [660, 990];
    o.type = "sine";
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(f2, t + 0.08);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g).connect(AUDIO.destination);
    o.start(t); o.stop(t + 0.16);
  } catch (e) {}
}
/* A distinct two-note chime for a mail that interrupts you. */
function chime() {
  try {
    AUDIO ||= new (window.AudioContext || window.webkitAudioContext)();
    if (AUDIO.state === "suspended") AUDIO.resume();
    [[880, 0], [1320, 0.13]].forEach(([f, d]) => {
      const t = AUDIO.currentTime + d, o = AUDIO.createOscillator(), g = AUDIO.createGain();
      o.type = "triangle"; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.1, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g).connect(AUDIO.destination); o.start(t); o.stop(t + 0.32);
    });
  } catch (e) {}
}
function act(a, el) {
  blip(BACK.has(a));
  const before = C.U.interrupt;
  try { return actInner(a, el); } finally { if (C.U.interrupt && C.U.interrupt !== before) chime(); }
}
function actInner(a, el) {
  ACTS[a] = (ACTS[a] || 0) + 1;
  const id = el && el.dataset && el.dataset.id;
  if (id) ACTS[a + ":" + id] = (ACTS[a + ":" + id] || 0) + 1;
  if (!C.oneAct(a, el)) C.studioAct(a, el);
}
view.addEventListener("click", (e) => {
  const u = e.target.closest("[data-u]"); if (!u) return;
  act(u.dataset.u, u);
  render();
  if (["pull", "jump", "ask"].includes(u.dataset.u)) window.scrollTo(0, 0);
});
const suggBtns = () => [...document.querySelectorAll("#sugg button")];
const markSugg = (i) => suggBtns().forEach((b, n) => b.classList.toggle("sg-on", n === i));
const onSugg = () => suggBtns().findIndex((b) => b.classList.contains("sg-on"));
const resetSugg = () => markSugg(suggBtns().findIndex((b) => b.classList.contains("sg-def")));
view.addEventListener("input", (e) => {
  if (e.target.id !== "u-new") return;
  C.U.typed = e.target.value;
  document.getElementById("sugg").innerHTML = C.oneSuggest(e.target.value);
  resetSugg();
});
/* Cmd-Z or Ctrl-Z undoes the last inbox action. */
document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() !== "z" || !(e.metaKey || e.ctrlKey) || e.shiftKey) return;
  const t = e.target; if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
  e.preventDefault(); act("undoLast", { dataset: {} }); render();
});
/* Enter and Esc act on the card in front, unless focus is in a text field. In the after-meeting field, Esc means "Nichts zu notieren". */
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== "Escape") return;
  const t = e.target, typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");
  if (typing && !(t.id === "u-after" && e.key === "Escape")) return;
  if (!typing && e.key === "Enter" && t && t.closest && t.closest("button,a,summary,label")) return;
  const k = C.U.keysNow && C.U.keysNow[e.key === "Enter" ? "enter" : "esc"]; if (!k) return;
  e.preventDefault();
  act(k[0], { dataset: { id: k[1] || undefined, to: k[2] || undefined } });
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  render();
});
view.addEventListener("keydown", (e) => {
  if (e.target.id === "u-new" && e.key === "Escape") { C.U.typed = ""; render(); return; }
  if (e.target.id === "u-new" && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
    const n = suggBtns().length; if (!n) return;
    e.preventDefault();
    markSugg((onSugg() + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
    return;
  }
  if (e.target.id === "u-new" && e.key === "Enter" && onSugg() >= 0) { e.preventDefault(); const pick = suggBtns()[onSugg()]; pick.click(); const f = document.getElementById("u-new"); if (f && pick.dataset.u === "add") f.focus(); return; }
  if (e.key !== "Enter") return;
  const map = { "u-new": C.isQuestion(e.target.value) ? "ask" : "add", "u-raise": "raise", "u-after": "afterKeep", "u-add": "addrow", "st-idea": "stIdea" }, say = e.target.id.startsWith("st-say-"), a = say ? "stSay" : map[e.target.id];
  if (!a) return;
  act(a, say ? { dataset: { id: e.target.id.slice(7) } } : e.target);
  render();
  if (e.target.id === "u-new" && a !== "ask") { const f = document.getElementById("u-new"); if (f) f.focus(); }
});
