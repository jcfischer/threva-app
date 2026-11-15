import { describe, expect, test } from "bun:test";
import { act, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createClient, type Fetch } from "../src/ui/api/client";
import type { StudioList, StudioMaterial, StudioNote, StudioThread } from "../src/ui/api/types";
import { TopicCard } from "../src/ui/desk/topic-card";
import { noteCards, relationTarget } from "../src/ui/desk/cards";
import { Desk } from "../src/ui/desk/desk";
import { OpenCard } from "../src/ui/desk/open-card";
import { createI18n, I18nProvider } from "../src/ui/i18n";
import { STUDIO_ACT_PATH } from "../src/ui/studio/act";
import { inputText, mountDom } from "./fixtures/dom";
import { budgetThread, studioList } from "./fixtures/studio";

const NOW = Date.parse("2026-11-14T12:00:00Z");
const relation: StudioNote = budgetThread.notes[3];
const topic: StudioThread = {
  ...budgetThread,
  slug: "offsite-in-march",
  type: "topic",
  question: "What is the March offsite for?",
  notes: [
    { at: "2026-11-14T11:00:00Z", kind: "idea", status: "dismissed", text: "Do not show this." },
    { at: "2026-11-14T10:00:00Z", kind: "relation", status: "kept", text: "Grace asks which week works. The first clashes with the budget review." },
    { at: "2026-11-13T10:00:00Z", kind: "note", status: "open", text: "An older note." },
  ],
};
const relating = (relates?: StudioMaterial): StudioNote => ({ ...relation, relates });
const list = studioList([budgetThread, topic]);

describe("relation follow targets", () => {
  test("thread slugs resolve across active, parked and closed topics", () => {
    for (const state of ["active", "parked", "closed"] as const) {
      const target = { ...topic, state };
      const studio = studioList(state === "active" ? [target] : [], state === "parked" ? [target] : [], state === "closed" ? [target] : []);
      expect(relationTarget(relation, studio)).toEqual({ kind: "topic", topic: target });
    }
  });

  test("a missing topic stays plain text, even with an href", () => {
    const note = relating({ kind: "thread", label: "missing-slug", href: "https://example.org" });
    for (const studio of [list, studioList([]), { studio: null }, null]) {
      expect(relationTarget(note, studio)).toEqual({ kind: "text", label: "missing-slug" });
    }
  });

  test("only link relations with safe hrefs become links", () => {
    for (const kind of ["goal", "person", "file"]) {
      expect(relationTarget(relating({ kind, label: "Cortex's label", href: "https://example.org" }), list)).toEqual({ kind: "text", label: "Cortex's label" });
    }
    for (const href of [undefined, "javascript:alert(1)", "data:text/html,hello", "/relative"]) {
      expect(relationTarget(relating({ kind: "link", label: "Read this", href }), list)).toEqual({ kind: "text", label: "Read this" });
    }
    expect(relationTarget(relating({ kind: "link", label: "Read this", href: "https://example.org/notes" }), list)).toEqual({ kind: "link", label: "Read this", href: "https://example.org/notes" });
  });

  test("missing relates and other note kinds have no target", () => {
    expect(relationTarget(relating(), list)).toBeNull();
    expect(relationTarget({ ...relation, kind: "idea" }, list)).toBeNull();
  });

  test("relation notes obey the same sorting, dismissal and dimming as every note", () => {
    const notes: StudioNote[] = Array.from({ length: 7 }, (_, i) => ({ ...relation, at: `2026-11-1${i}T00:00:00Z`, status: i === 0 ? "open" : "kept" }));
    const cards = noteCards([...notes, { ...relation, at: "2026-11-18T00:00:00Z", status: "dismissed" }]);
    expect(cards.map(({ at, strength }) => [at, strength])).toEqual([
      ["2026-11-16T00:00:00Z", "dim"], ["2026-11-15T00:00:00Z", "dim"], ["2026-11-14T00:00:00Z", "dim"],
      ["2026-11-13T00:00:00Z", "dim"], ["2026-11-12T00:00:00Z", "dim"], ["2026-11-11T00:00:00Z", "faint"], ["2026-11-10T00:00:00Z", "open"],
    ]);
  });
});

const run = async () => ({ ok: true as const, data: {} });
const renderNote = (note: StudioNote, locale: "en" | "de" = "en") => renderToStaticMarkup(
  <I18nProvider value={createI18n(locale)}>
    <OpenCard thing={{ side: "right", id: note.at, note }} slug={budgetThread.slug} now={NOW} onClose={() => {}} run={run} target={relationTarget(note, list)} onFollow={() => {}} />
  </I18nProvider>,
);

describe("opened relation content", () => {
  test("shows the topic question and Follow, with catalog labels in both languages", () => {
    expect(renderNote(relation)).toContain(topic.question);
    expect(renderNote(relation)).toContain(">Follow<");
    expect(renderNote(relation)).toContain(">Keep<");
    expect(renderNote(relation)).toContain(">Dismiss<");
    const de = renderNote(relation, "de");
    for (const text of ["Bezug", "Folgen", "Behalten", "Verwerfen"]) expect(de).toContain(text);
    for (const status of ["kept", "dismissed"] as const) {
      const html = renderNote({ ...relation, status });
      expect(html).not.toContain(">Keep<");
      expect(html).not.toContain(">Dismiss<");
    }
  });

  test("non-topic labels stay as Cortex sends them and safe links open in a new tab", () => {
    for (const relates of [
      { kind: "thread", label: "gone-topic" }, { kind: "goal", label: "G5: one post a week" }, { kind: "person", label: "Ana" },
      { kind: "link", label: "Unsafe", href: "javascript:alert(1)" }, { kind: "link", label: "No href" },
    ]) {
      const html = renderNote(relating(relates));
      expect(html).toContain(relates.label);
      expect(html).not.toContain(">Follow<");
      expect(html).not.toContain("<a ");
    }
    expect(renderNote(relating({ kind: "link", label: "Read this", href: "https://example.org/notes" }))).toContain('href="https://example.org/notes" target="_blank" rel="noreferrer">Read this</a>');
  });

  test("the topic summary shows its exact type, state and newest nondismissed first sentence", () => {
    for (const locale of ["en", "de"] as const) {
      for (const type of ["question", "topic", "making"] as const) {
        for (const state of ["active", "parked", "closed"] as const) {
          const i18n = createI18n(locale);
          const html = renderToStaticMarkup(<I18nProvider value={i18n}>
            <TopicCard topic={{ ...topic, type, state }} now={NOW} onClose={() => {}} onOpenDesk={() => {}} />
          </I18nProvider>);
          expect(html).toContain(i18n.t(`desk.topic.type.${type}`));
          expect(html).toContain(topic.question);
          expect(html).toContain("Grace asks which week works.");
          expect(html).toContain(locale === "en" ? "2 h ago" : "vor 2 Std.");
          expect(html).not.toContain("The first clashes");
          expect(html).not.toContain("Do not show this");
          expect(html).toContain(i18n.t("desk.topic.open"));
          if (state !== "active") expect(html).toContain(i18n.t(`desk.topic.${state}`));
        }
      }
    }
  });
});

async function withDesk(body: (container: HTMLElement, rerender: (studio: StudioList) => Promise<void>) => Promise<void>, studio = list, fetchImpl: Fetch = async () => Response.json({})) {
  const { root, container, cleanup } = mountDom();
  function Harness({ studio }: { studio: StudioList }) {
    const [slug, setSlug] = useState(budgetThread.slug);
    return <I18nProvider value={createI18n("en")}>
      <Desk client={createClient(fetchImpl)} studio={studio} slug={slug} backLabel="Back" onBack={() => {}} now={NOW} onOpenDesk={setSlug} />
    </I18nProvider>;
  }
  const render = async (studio: StudioList) => { await act(async () => { root.render(<Harness studio={studio} />); }); };
  try {
    await render(studio);
    await body(container, render);
  } finally {
    await cleanup();
  }
}

async function click(container: HTMLElement, selector: string) {
  const element = container.querySelector<HTMLButtonElement>(selector);
  if (!element) throw new Error(`Missing ${selector}`);
  await act(async () => { element.click(); });
}

async function press(container: HTMLElement, side: "left" | "right", label: string) {
  const button = [...container.querySelectorAll<HTMLButtonElement>(`[data-desk-opened="${side}"] button`)].find((button) => button.textContent === label);
  if (!button) throw new Error(`Missing ${label}`);
  await act(async () => { button.click(); });
}

const openRelation = (container: HTMLElement) => click(container, `[data-desk-card="${relation.at}"]`);
const opened = (container: HTMLElement, side: "left" | "right") => container.querySelector<HTMLElement>(`[data-desk-opened="${side}"]`);

describe("following on the desk", () => {
  test("replaces material on the left, preserves the right note and its answer, and reads refreshed topic data", async () => {
    await withDesk(async (container, rerender) => {
      await click(container, '[data-desk-card="m0"]');
      await openRelation(container);
      await inputText(opened(container, "right")!.querySelector("input")!, "Keep this answer.");
      await press(container, "right", "Follow");
      expect(opened(container, "left")?.textContent).toContain(topic.question);
      expect(opened(container, "left")?.getAttribute("data-placed")).toBe("true");
      expect(container.querySelectorAll('[data-desk-opened="left"]')).toHaveLength(1);
      expect(opened(container, "right")?.textContent).toContain(relation.text);
      expect(opened(container, "right")?.querySelector("input")?.value).toBe("Keep this answer.");
      await rerender(studioList([budgetThread], [{ ...topic, state: "parked", notes: [{ ...relation, text: "A fresh note.", at: "2026-11-14T11:30:00Z" }] }]));
      expect(opened(container, "left")?.textContent).toContain("This topic is parked.");
      expect(opened(container, "left")?.textContent).toContain("A fresh note.");
      await press(container, "left", "Put back");
      expect(opened(container, "left")).toBeNull();
      expect(opened(container, "right")).not.toBeNull();
      await press(container, "right", "Follow");
      await click(container, '[data-desk-card="m1"]');
      expect(opened(container, "left")?.textContent).toContain("BRIEF.md");
      expect(opened(container, "right")).not.toBeNull();
    });
  });

  test("works without material and Open its desk navigates and resets both slots without a conversation", async () => {
    const requests: string[] = [];
    await withDesk(async (container) => {
      await openRelation(container);
      await press(container, "right", "Follow");
      expect(opened(container, "left")?.getAttribute("data-placed")).toBe("true");
      await press(container, "left", "Open its desk");
      expect(container.querySelector("h2")?.textContent).toBe(topic.question);
      expect(container.querySelectorAll("[data-desk-opened]")).toHaveLength(0);
    }, studioList([{ ...budgetThread, material: [] }, topic]), async (path) => {
      requests.push(path);
      return Response.json({});
    });
    expect(requests).toEqual([]);
  });

  test("Escape closes both slots", async () => {
    await withDesk(async (container) => {
      await openRelation(container);
      await press(container, "right", "Follow");
      await act(async () => { window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" })); });
      expect(container.querySelectorAll("[data-desk-opened]")).toHaveLength(0);
    });
  });

  for (const action of ["keep", "dismiss"] as const) {
    test(`${action} uses the Studio act client for the relation note`, async () => {
      const posts: { path: string; body: Record<string, unknown> }[] = [];
      await withDesk(async (container) => {
        await openRelation(container);
        await press(container, "right", "Follow");
        await press(container, "right", action === "keep" ? "Keep" : "Dismiss");
        expect(opened(container, "right")).toBeNull();
        expect(opened(container, "left")?.textContent).toContain(topic.question);
      }, list, async (path, init) => {
        posts.push({ path, body: JSON.parse(typeof init?.body === "string" ? init.body : "{}") });
        return Response.json({ ok: true, message: "Saved." });
      });
      expect(posts).toHaveLength(1);
      expect(posts[0]?.path).toBe(STUDIO_ACT_PATH);
      expect(posts[0]?.body).toMatchObject({ act: action, thread: budgetThread.slug, note: relation.at });
      expect(posts[0]?.body.requestId).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    });
  }

  test("Cortex's refusal stays on the relation card", async () => {
    await withDesk(async (container) => {
      await openRelation(container);
      await press(container, "right", "Keep");
      expect(opened(container, "right")?.textContent).toContain("This relation is no longer open. Nothing was written.");
    }, list, async () => Response.json({ error: "This relation is no longer open. Nothing was written." }, { status: 409 }));
  });
});
