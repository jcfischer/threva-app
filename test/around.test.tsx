import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createClient } from "../src/ui/api/client";
import type { DeskView, MailSweep, StudioList } from "../src/ui/api/types";
import { QueueContext } from "../src/ui/cards/act";
import { createI18n, I18nProvider } from "../src/ui/i18n";
import { around } from "../src/ui/queue/around";
import { buildQueue, EMPTY_SESSION, pin, type Session } from "../src/ui/queue/order";
import { QueueBody } from "../src/ui/queue/queue-view";
import { item, NOW, studio, thread, view } from "./fixtures/desk";

const MIN = 60 * 1000;

const newsletters: MailSweep = {
  id: "sw1",
  kind: "sweep",
  target: "archive",
  label: "Newsletters",
  title: "Three newsletters from this week",
  why: "You let mail like this go before.",
  mails: [
    { key: "m1", from: "News A", subject: "Issue 1" },
    { key: "m2", from: "News B", subject: "Issue 2" },
    { key: "m3", from: "News C", subject: "Issue 3" },
  ],
};

const meeting = item({ key: "standup", kind: "meeting", title: "Team standup", why: "Starts in 10 minutes.", eventKey: "e1" });
const mails = ["Invoice", "Workshop dates", "Lunch Friday", "Old thread"].map((title, i) => item({ key: `m${i}`, kind: "mail", title, why: "From a person." }));
const busyDesk = view({
  items: [meeting, ...mails],
  today: [{ key: "e1", at: NOW + 10 * MIN, end: NOW + 40 * MIN, title: "Team standup", kind: "meeting" }],
  mailSweeps: [newsletters],
});

function render(desk: DeskView, opts: { locale?: "en" | "de"; session?: Session; studio?: StudioList | null } = {}) {
  return renderToStaticMarkup(
    <I18nProvider value={createI18n(opts.locale ?? "en")}>
      <QueueContext.Provider value={{ client: createClient(async () => new Response("{}")), refresh: () => {} }}>
        <QueueBody state={{ view: desk, studio: opts.studio ?? null, error: null }} session={opts.session ?? EMPTY_SESSION} setSession={() => {}} now={NOW} />
      </QueueContext.Provider>
    </I18nProvider>,
  );
}

describe("around", () => {
  test("takes Cortex's why for the current card and lists up to three next titles", () => {
    const result = around(buildQueue(busyDesk, null, EMPTY_SESSION, NOW));
    expect(result.why).toEqual({ kind: "cortex", text: "Starts in 10 minutes." });
    expect(result.then).toEqual({ titles: [{ k: "i:m0", title: "Invoice" }, { k: "i:m1", title: "Workshop dates" }, { k: "i:m2", title: "Lunch Friday" }], more: 1, sweeps: [{ k: "s:sw1", label: "Newsletters", count: 3 }] });
  });

  test("names a catalog reason for an after-meeting card, a waiting thread and a task", () => {
    const ended = view({ today: [{ key: "e0", at: NOW - 60 * MIN, end: NOW - 5 * MIN, title: "Board call", kind: "meeting" }] });
    expect(around(buildQueue(ended, null, EMPTY_SESSION, NOW)).why).toEqual({ kind: "after", title: "Board call" });
    expect(around(buildQueue(view(), studio(thread("s1", "open", false)), EMPTY_SESSION, NOW)).why).toEqual({ kind: "thread" });
    const task = view({ myDay: { items: [{ task: { id: "t1", title: "Write the report" }, areaTitle: "Work" }] } });
    expect(around(buildQueue(task, null, EMPTY_SESSION, NOW)).why).toEqual({ kind: "task" });
  });

  test("has no Then line for a single card and neither line for an empty queue", () => {
    expect(around(buildQueue(view({ items: [meeting] }), null, EMPTY_SESSION, NOW)).then).toBeNull();
    expect(around([])).toEqual({ why: null, then: null });
  });

  test("a sweep link's key brings that sweep to the front through the pin", () => {
    const link = around(buildQueue(busyDesk, null, EMPTY_SESSION, NOW)).then?.sweeps[0];
    expect(link).toBeDefined();
    const pinned = buildQueue(busyDesk, null, pin(EMPTY_SESSION, link?.k ?? ""), NOW);
    expect(pinned[0]?.k).toBe("s:sw1");
  });

  test("each Then title brings its own card to the front and can let it move again", () => {
    const titles = around(buildQueue(busyDesk, null, EMPTY_SESSION, NOW)).then?.titles ?? [];
    expect(titles).toHaveLength(3);
    for (const title of titles) {
      const session = pin(EMPTY_SESSION, title.k);
      expect(buildQueue(busyDesk, null, session, NOW)[0]?.k).toBe(title.k);
      expect(render(busyDesk, { session })).toContain("Let it move");
      expect(buildQueue(busyDesk, null, pin(session, title.k), NOW)[0]?.k).toBe("i:standup");
    }
  });
});

describe("the lines around the card", () => {
  test("shows Why now above the card and Then below it", () => {
    const html = render(busyDesk);
    expect(html).toContain("<b>Why now:</b> Starts in 10 minutes.");
    expect(html).toContain("Then");
    expect(html).toContain("Invoice");
    expect(html).toContain('<button type="button" class="lk">Invoice</button>');
    expect(html).toContain("and 1 more");
    expect(html).toContain("Newsletters: let 3 go?");
    expect(html.indexOf("Why now:")).toBeLessThan(html.indexOf("Team standup"));
    expect(html.indexOf("Team standup")).toBeLessThan(html.indexOf('class="nextline"'));
  });

  test("shows the lines in German", () => {
    const html = render(busyDesk, { locale: "de" });
    expect(html).toContain("<b>Warum jetzt:</b>");
    expect(html).toContain("Danach");
    expect(html).toContain("und 1 weitere");
    expect(html).toContain("Newsletters: 3 weglegen?");
  });

  test("uses a catalog sentence for an after-meeting card", () => {
    const ended = view({ today: [{ key: "e0", at: NOW - 60 * MIN, end: NOW - 5 * MIN, title: "Board call", kind: "meeting" }] });
    expect(render(ended)).toContain("“Board call” just ended.");
  });

  test("leaves out the Then line for a single card", () => {
    const html = render(view({ items: [meeting] }));
    expect(html).toContain("Why now:");
    expect(html).not.toContain('class="nextline"');
  });

  test("shows neither line for an empty queue, only the empty state", () => {
    const html = render(view());
    expect(html).not.toContain("Why now:");
    expect(html).not.toContain('class="nextline"');
    expect(html).toContain("Nothing needs you right now.");
  });
});
