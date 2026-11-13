import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createClient, type Fetch } from "../src/ui/api/client";
import { QueueContext } from "../src/ui/cards/act";
import { createI18n, I18nProvider } from "../src/ui/i18n";
import { buildQueue, EMPTY_SESSION, pin, skip } from "../src/ui/queue/order";
import { QueueBody } from "../src/ui/queue/queue-view";
import { loadDesk } from "../src/ui/queue/use-desk";
import { item, NOW, studio, thread, view } from "./fixtures/desk";

const HOUR = 60 * 60 * 1000;

describe("buildQueue", () => {
  const desk = view({
    items: [
      item({ key: "old", kind: "reminder", score: 9, since: NOW - 48 * HOUR }),
      item({ key: "fresh", kind: "sensor", score: 2, since: NOW - HOUR }),
      item({ key: "agent", kind: "agent-blocked", score: 1 }),
    ],
    myDay: { items: [{ task: { id: "t1", title: "Write the report" }, areaTitle: "Work" }] },
  });

  test("orders waiting agents, waiting threads, fresh items, other items, then today's list", () => {
    const queue = buildQueue(desk, studio(thread("s1", "open", false), thread("s2", "open", true)), EMPTY_SESSION, NOW);
    expect(queue.map((e) => e.k)).toEqual(["i:agent", "t:s1", "i:fresh", "i:old", "d:t1"]);
  });

  test("a thread waits only while its latest note is open and unanswered", () => {
    const queue = buildQueue(view(), studio(thread("a", "open", false), thread("b", "kept", false), thread("c", "open", true)), EMPTY_SESSION, NOW);
    expect(queue.map((e) => e.k)).toEqual(["t:a"]);
  });

  test("skip moves an entry to the end and pin brings one to the front", () => {
    const skipped = buildQueue(desk, null, skip(EMPTY_SESSION, "i:agent"), NOW);
    expect(skipped.at(-1)?.k).toBe("i:agent");
    const pinned = buildQueue(desk, null, pin(EMPTY_SESSION, "d:t1"), NOW);
    expect(pinned[0]?.k).toBe("d:t1");
  });
});

describe("client", () => {
  test("returns Cortex's error text on a failed write", async () => {
    const fetchStub: Fetch = async () => new Response(JSON.stringify({ ok: false, error: "Ranger actions are not set up on this stack." }), { status: 409 });
    const result = await createClient(fetchStub).post("/api/desk/action", { action: "ranger.approve", key: "k" });
    expect(result).toEqual({ ok: false, message: "Ranger actions are not set up on this stack.", status: 409 });
  });

  test("reports a network failure without a message", async () => {
    const fetchStub: Fetch = async () => {
      throw new TypeError("offline");
    };
    expect(await createClient(fetchStub).desk()).toEqual({ ok: false, message: null, status: 0 });
  });

  test("sends writes as same-origin JSON", async () => {
    let seen: RequestInit | undefined;
    const fetchStub: Fetch = async (_input, init) => {
      seen = init;
      return new Response("{}");
    };
    await createClient(fetchStub).post("/api/desk/ruling", { key: "k" });
    expect(seen?.method).toBe("POST");
    expect(new Headers(seen?.headers).get("content-type")).toBe("application/json");
  });

  test("a failed poll keeps the last good data", async () => {
    const good = view({ items: [item({ key: "x", kind: "sensor" })] });
    const failing: Fetch = async () => new Response("", { status: 502 });
    const next = await loadDesk(createClient(failing), { view: good, studio: null, error: null });
    expect(next.view).toBe(good);
    expect(next.error).toEqual({ message: null });
  });
});

describe("queue rendering", () => {
  const render = (state: Parameters<typeof QueueBody>[0]["state"], locale: "en" | "de" = "en") =>
    renderToStaticMarkup(
      <I18nProvider value={createI18n(locale)}>
        <QueueContext.Provider value={{ client: createClient(async () => new Response("{}")), refresh: () => {} }}>
          <QueueBody state={state} session={EMPTY_SESSION} setSession={() => {}} now={NOW} />
        </QueueContext.Provider>
      </I18nProvider>,
    );

  test("shows the first card with the agent's choices", () => {
    const html = render({
      view: view({
        items: [
          item({
            key: "a",
            kind: "decision",
            title: "Which database?",
            explanation: { sentence: "The agent needs a database choice.", choices: [{ label: "SQLite", consequence: "Simple, local.", ruling: "Use SQLite." }] },
          }),
        ],
      }),
      studio: null,
      error: null,
    });
    expect(html).toContain("Which database?");
    expect(html).toContain("SQLite");
    expect(html).toContain("Decide and tell the agent");
    expect(html).toContain("1 card");
  });

  test("shows the empty state in German", () => {
    expect(render({ view: view(), studio: null, error: null }, "de")).toContain("Nichts braucht dich gerade.");
  });

  test("shows Cortex's error and keeps the cards", () => {
    const html = render({ view: view({ items: [item({ key: "x", kind: "sensor", title: "Still here" })] }), studio: null, error: { message: "Desk is busy." } });
    expect(html).toContain("Desk is busy.");
    expect(html).toContain("Still here");
  });
});
