import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { DeskClient } from "../api/client";
import type { StudioList, StudioProject, StudioThread } from "../api/types";
import { QueueContext } from "../cards/act";
import { ErrorLine } from "../cards/parts";
import { useI18n } from "../i18n";
import { POLL_MS } from "../queue/use-desk";
import { useStudioAct } from "../studio/act";
import { NoteEditor } from "./editor";
import { useAddressedLines } from "./addressed";
import { Margin, ThreadDate } from "./margin";

export interface ThreadEntry {
  at: string;
  author: "you" | "assistant";
  text: string;
}

/** Only accepted notes join the user's responses on the page. Open notes stay in the margin. */
export function orderedThreadEntries(thread: StudioThread): ThreadEntry[] {
  return [
    ...thread.responses.map(response => ({ at: response.at, author: "you" as const, text: response.text })),
    ...thread.notes.filter(note => note.status === "kept").map(note => ({ at: note.at, author: "assistant" as const, text: note.text })),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

export function ThreadPage({ client, project, assistantName, active = true, initialStudio = null, onChange }: {
  client: DeskClient;
  project: StudioProject;
  assistantName?: string;
  active?: boolean;
  initialStudio?: StudioList | null;
  onChange: () => void;
}) {
  const { t } = useI18n();
  const [studio, setStudio] = useState(initialStudio);
  const [loading, setLoading] = useState(initialStudio === null);
  // Keep the draft while an unreadable or closed thread hides its editor.
  const [text, setText] = useState("");
  const version = useRef(0);
  const read = useCallback(async () => {
    const current = ++version.current;
    const result = await client.studio();
    if (version.current !== current) return;
    setStudio(result.ok ? result.data : null);
    setLoading(false);
  }, [client]);
  useEffect(() => {
    if (!active || project.state === null) return;
    void read();
    const timer = setInterval(() => { void read(); }, POLL_MS);
    return () => { ++version.current; clearInterval(timer); };
  }, [active, project.state, read]);
  const refresh = useCallback(() => { void read(); onChange(); }, [read, onChange]);
  const data = studio?.studio;
  const thread = data ? [...data.active, ...(data.parked ?? []), ...(data.closed ?? [])].find(thread => thread.slug === project.slug) : null;
  if (project.state === null) return <p role="status">{t("thread.unavailable")}</p>;
  if (loading) return <p role="status">{t("thread.loading")}</p>;
  if (!thread) return <p role="status">{t("thread.unavailable")}</p>;
  return <QueueContext.Provider value={{ client, refresh }}>
    <ThreadDocument thread={thread} closed={project.state === "closed" || thread.state === "closed"} assistantName={assistantName} text={text} setText={setText} />
  </QueueContext.Provider>;
}

function ThreadDocument({ thread, closed, assistantName, text, setText }: { thread: StudioThread; closed: boolean; assistantName?: string; text: string; setText: Dispatch<SetStateAction<string>> }) {
  const { t } = useI18n();
  const { busy, error, run } = useStudioAct();
  const draft = useRef(text);
  draft.current = text;
  const sending = useRef(false);
  const [said, setSaid] = useState(false);
  const name = assistantName || t("studio.assistant");
  const type = (next: string) => { draft.current = next; setText(next); setSaid(false); };
  const respond = async (words: string) => {
    if (sending.current || !words.trim()) return false;
    sending.current = true;
    setSaid(false);
    try {
      const result = await run({ act: "respond", thread: thread.slug, text: words.trim() });
      if (result.ok) setSaid(true);
      return result.ok;
    } finally {
      sending.current = false;
    }
  };
  const addressed = useAddressedLines(assistantName ?? null, t("thread.enter", { name }), respond);
  return <div className="thread-page">
    <div className="thread-main stack">
      <div className="thread-stand">
        <span className="eyebrow">{t("studio.stand")}</span>
        <p>{thread.stand || t("studio.stand.none")}</p>
      </div>
      {orderedThreadEntries(thread).map((entry, index) => <div key={`${entry.author}-${entry.at}-${index}`} className={`thread-entry${entry.author === "assistant" ? " thread-kept" : ""}`}>
        <span className="faint">{entry.author === "assistant" ? name : t("studio.you")}, <ThreadDate at={entry.at} />: </span>{entry.text}
      </div>)}
      {closed ? <p role="status">{t("thread.closed")}</p> : <>
        <NoteEditor value={text} label={t("thread.editor")} hint={t("thread.hint", { name })} place={null}
          onChange={type} onLeave={() => {}}
          {...addressed} />
        <div className="row">
          <button type="button" className="btn" disabled={busy || !text.trim()} onClick={async () => {
            const sent = draft.current;
            if (await respond(sent)) {
              // An answer to an earlier draft must not erase text typed while Cortex was writing.
              setText(current => current === sent ? "" : current);
            }
          }}>{t("thread.add")}</button>
          <ErrorLine error={error} />
          {said && <span className="faint" role="status">{t("thread.added", { name })}</span>}
        </div>
      </>}
    </div>
    <Margin notes={thread.notes.filter(note => note.status === "open")} slug={thread.slug} name={name} writable={!closed} />
  </div>;
}
