import { useEffect, useRef, useState } from "react";
import { lines, linkedConversation, readExchange, sendInput, sessionCall, startConversation, type Exchange, type StudioSession } from "../api/conversations";
import { ErrorLine } from "../cards/parts";
import { useQueue, type ActError } from "../cards/act";
import { useI18n } from "../i18n";

const POLL_MS = 1500;
const POLL_LIMIT = 80;

export function ExchangeView({ exchange, outbox }: { exchange: Exchange; outbox?: string | null }) {
  const { t } = useI18n();
  const shown = lines(exchange.entries);
  const sent = outbox && !shown.some((e) => e.role === "user" && e.text === outbox);
  return (
    <div className="stack" style={{ gap: 10 }} aria-label={exchange.conversation.title}>
      {shown.map((e) =>
        e.role === "user" ? (
          <div key={e.id} className="stnote">
            <span className="eyebrow">{t("studio.you")}</span>
            <p>{e.text}</p>
          </div>
        ) : (
          <div key={e.id} className="stnote">
            <span className="eyebrow">
              {t("studio.assistant")}
              {(e.model ?? exchange.using) && ` · ${e.model ?? exchange.using}`}
            </span>
            {e.error ? <p className="faint">{e.error}</p> : <p>{e.text}</p>}
          </div>
        ),
      )}
      {sent && (
        <div className="stnote">
          <span className="eyebrow">{t("studio.you")}</span>
          <p>{outbox}</p>
        </div>
      )}
      {exchange.working && <span className="faint">{t("talk.working")}</span>}
    </div>
  );
}

type Linked = { state: "loading" } | { state: "none" } | { state: "linked"; id: string };

/** The card's conversation: starts one from the thread, or continues the one Cortex already links to it. */
export function TalkItThrough({ thread }: { thread: string }) {
  const { t } = useI18n();
  const { client } = useQueue();
  const [linked, setLinked] = useState<Linked>({ state: "loading" });
  const [shown, setShown] = useState(false);
  const [exchange, setExchange] = useState<Exchange | null>(null);
  const [text, setText] = useState("");
  const [outbox, setOutbox] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ActError>(null);
  const startId = useRef(crypto.randomUUID());
  const input = useRef<{ text: string; id: string } | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    linkedConversation(client, thread).then((id) => {
      if (live) setLinked(id ? { state: "linked", id } : { state: "none" });
    });
    return () => {
      live = false;
    };
  }, [client, thread]);

  async function follow(id: string) {
    for (let i = 0; i < POLL_LIMIT && alive.current; i++) {
      const r = await readExchange(client, id);
      if (!alive.current) return;
      if (!r.ok) {
        setError({ message: r.message });
        return;
      }
      setExchange(r.data);
      if (!r.data.working) return;
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
  }

  async function open() {
    setError(null);
    setShown(true);
    if (linked.state === "linked") return follow(linked.id);
    setBusy(true);
    const r = await startConversation(client, thread, startId.current);
    setBusy(false);
    if (!r.ok) {
      setShown(false);
      setError({ message: r.message });
      return;
    }
    setLinked({ state: "linked", id: r.data.conversation.id });
    await follow(r.data.conversation.id);
  }

  async function send() {
    if (linked.state !== "linked") return;
    const body = text.trim();
    const retry = input.current?.text === body ? input.current.id : crypto.randomUUID();
    input.current = { text: body, id: retry };
    setBusy(true);
    setError(null);
    const r = await sendInput(client, linked.id, retry, body);
    setBusy(false);
    if (!r.ok) {
      setError({ message: r.message });
      return;
    }
    input.current = null;
    setText("");
    setOutbox(body);
    await follow(linked.id);
    if (alive.current) setOutbox(null);
  }

  if (linked.state === "loading") return null;
  return (
    <div className="stack">
      {!shown && (
        <div className="row">
          <button type="button" className="btn" disabled={busy} onClick={open}>
            {linked.state === "linked" ? t("talk.continue") : t("talk.start")}
          </button>
        </div>
      )}
      {shown && exchange && <ExchangeView exchange={exchange} outbox={outbox} />}
      {shown && linked.state === "linked" && (
        <>
          <textarea aria-label={t("talk.message")} placeholder={t("talk.message")} value={text} onChange={(e) => setText(e.target.value)} rows={2} />
          <div className="row">
            <button type="button" className="btn pri" disabled={busy || !text.trim()} onClick={send}>
              {t("studio.send")}
            </button>
          </div>
        </>
      )}
      <ErrorLine error={error} />
    </div>
  );
}

export function SessionView({ session }: { session: StudioSession }) {
  const { t } = useI18n();
  return (
    <div className="stack" style={{ gap: 8 }}>
      {session.turns.map((turn) => (
        <div key={turn.id} className="stack" style={{ gap: 6 }}>
          <div className="stnote">
            <span className="eyebrow">{t("studio.you")}</span>
            <p>{turn.text}</p>
          </div>
          {turn.answer && (
            <div className="stnote">
              <span className="eyebrow">
                {t("studio.assistant")} · {turn.model}
              </span>
              <p>{turn.answer.reply}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** A live session on one note: Cortex answers each turn, and the exchange is kept until you leave it. */
export function DiscussNote({ thread, note }: { thread: string; note: string }) {
  const { t } = useI18n();
  const { client, refresh } = useQueue();
  const [session, setSession] = useState<StudioSession | null>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ActError>(null);
  const id = useRef(crypto.randomUUID());
  const turn = useRef<{ text: string; id: string } | null>(null);

  async function begin() {
    setBusy(true);
    setError(null);
    const r = await sessionCall(client, { action: "start", id: id.current, thread, scope: { kind: "ghost", note } });
    setBusy(false);
    if (!r.ok) return setError({ message: r.message });
    setSession(r.data.session);
    setOpen(true);
  }

  async function say() {
    const body = text.trim();
    const retry = turn.current?.text === body ? turn.current.id : crypto.randomUUID();
    turn.current = { text: body, id: retry };
    setBusy(true);
    setError(null);
    const r = await sessionCall(client, { action: "say", id: id.current, turn: retry, text: body });
    setBusy(false);
    if (r.ok) {
      turn.current = null;
      setText("");
      setSession(r.data.session);
    } else {
      setError({ message: r.message });
    }
  }

  async function leave() {
    setBusy(true);
    const r = await sessionCall(client, { action: "end", id: id.current, outcome: { kind: "leave" } });
    setBusy(false);
    if (!r.ok) return setError({ message: r.message });
    setOpen(false);
    refresh();
  }

  if (!open) {
    return (
      <>
        <button type="button" className="btn" disabled={busy} onClick={begin}>
          {t("studio.discuss")}
        </button>
        <ErrorLine error={error} />
      </>
    );
  }
  return (
    <div className="stack" style={{ flexBasis: "100%" }}>
      {session && <SessionView session={session} />}
      <textarea aria-label={t("talk.message")} placeholder={t("talk.message")} value={text} onChange={(e) => setText(e.target.value)} rows={2} />
      <div className="row">
        <button type="button" className="btn pri" disabled={busy || !text.trim()} onClick={say}>
          {t("studio.send")}
        </button>
        <button type="button" className="btn quiet" disabled={busy} onClick={leave}>
          {t("talk.leave")}
        </button>
      </div>
      <ErrorLine error={error} />
    </div>
  );
}
