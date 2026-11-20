import { describe, expect, test } from "bun:test";
import { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Result } from "@desk/client";
import { createMemoryClient, type Answer } from "@desk/memory-client";
import type { StudioThread } from "@desk/types";
import { QueueContext } from "../src/ui/cards/act";
import { Desk } from "../src/ui/desk/desk";
import { standLine } from "../src/ui/desk/topic-menu";
import { useStudioAct } from "../src/ui/studio/act";
import { createI18n, I18nProvider } from "../src/ui/i18n";
import { closeAct, outcomesFor, threadType } from "../src/ui/studio/close";
import { inputText, mountDom } from "./fixtures/dom";
import { budgetThread, closedThread, studioList } from "./fixtures/studio";

const NOW = Date.parse("2026-11-14T12:00:00Z");

const asQuestion = { ...budgetThread, type: "question" as const };
const asMaking: StudioThread = { ...budgetThread, type: "making" };
const asTopic: StudioThread = { ...budgetThread, type: "topic" };

const render = (thread: StudioThread = budgetThread, locale: "en" | "de" = "en") =>
  renderToStaticMarkup(
    <I18nProvider value={createI18n(locale)}>
      <Desk client={createMemoryClient()} studio={studioList([thread])} slug={thread.slug} backLabel="Back" onBack={() => {}} now={NOW} />
    </I18nProvider>,
  );

describe("the acts a topic offers", () => {
  test("a question ends decided or dropped, a making topic shipped or dropped, a topic any of the three", () => {
    expect(outcomesFor("question")).toEqual(["decided", "dropped"]);
    expect(outcomesFor("making")).toEqual(["shipped", "dropped"]);
    expect(outcomesFor("topic")).toEqual(["decided", "shipped", "dropped"]);
  });

  test("a thread without a type is a question", () => {
    expect(threadType({})).toBe("question");
    expect(threadType({ type: "making" })).toBe("making");
  });

  test("the stand is one quiet line on a question topic and nowhere else", () => {
    expect(standLine(asQuestion)).toBe("Keep the team as it is and cut travel.");
    expect(standLine({ ...budgetThread, type: undefined })).toBe("Keep the team as it is and cut travel.");
    expect(standLine(asMaking)).toBeNull();
    expect(standLine(asTopic)).toBeNull();
    expect(standLine({ ...asQuestion, stand: "   " })).toBeNull();
  });

  test("a decision needs the text, what you expect and a review date", () => {
    const base = { outcome: "decided" as const, text: " We keep the team. ", expect: "", reviewOn: "" };
    expect(closeAct("t", base, "question")).toBeNull();
    expect(closeAct("t", { ...base, expect: "A lighter year." }, "question")).toBeNull();
    expect(closeAct("t", { ...base, expect: " A lighter year. ", reviewOn: "2026-12-15" }, "question")).toEqual({
      act: "close",
      thread: "t",
      outcome: "decided",
      text: "We keep the team.",
      expect: "A lighter year.",
      reviewOn: "2026-12-15",
    });
  });

  test("shipped and dropped need only the text, and an outcome the type does not allow is refused", () => {
    const base = { text: " The installer ships. ", expect: "", reviewOn: "" };
    expect(closeAct("t", { ...base, outcome: "shipped" }, "making")).toEqual({ act: "close", thread: "t", outcome: "shipped", text: "The installer ships." });
    expect(closeAct("t", { ...base, outcome: "dropped" }, "making")).toEqual({ act: "close", thread: "t", outcome: "dropped", text: "The installer ships." });
    expect(closeAct("t", { ...base, outcome: "shipped" }, "question")).toBeNull();
    expect(closeAct("t", { ...base, outcome: "decided" }, "making")).toBeNull();
    expect(closeAct("t", { ...base, outcome: "dropped" }, "topic")).toEqual({ act: "close", thread: "t", outcome: "dropped", text: "The installer ships." });
    expect(closeAct("t", { ...base, text: "  ", outcome: "shipped" }, "making")).toBeNull();
  });
});

describe("the menu at the head of the desk", () => {
  test("carries think tonight, park and finish", () => {
    const html = render();
    expect(html).toContain('data-desk-menu="true"');
    for (const label of ["Think about it tonight", ">Park<", ">Finish<"]) expect(html).toContain(label);
    expect(html.indexOf("What goes into next year&#x27;s budget?")).toBeLessThan(html.indexOf('data-desk-menu="true"'));
  });

  test("a parked topic reads park as taking it up again", () => {
    const html = render({ ...budgetThread, state: "parked" });
    expect(html).toContain(">Take it up again<");
    expect(html).not.toContain(">Park<");
  });

  test("a closed topic shows its outcome and the outcome text, and no menu", () => {
    const html = render(closedThread);
    expect(html).toContain('data-desk-outcome="dropped"');
    expect(html).toContain(">Dropped<");
    expect(html).toContain("It merges into the Desk.");
    expect(html).not.toContain('data-desk-menu="true"');
    expect(html).not.toContain(">Finish<");
  });

  test("the form does not carry over when the desk switches to another topic", async () => {
    const dom = mountDom();
    const client = createMemoryClient();
    const desk = (thread: StudioThread) => (
      <I18nProvider value={createI18n("en")}>
        <Desk client={client} studio={studioList([thread])} slug={thread.slug} backLabel="Back" onBack={() => {}} now={NOW} />
      </I18nProvider>
    );
    const other: StudioThread = { ...budgetThread, slug: "other-topic", question: "Another question?" };
    try {
      await act(async () => { dom.root.render(desk(budgetThread)); });
      const finish = Array.from(dom.container.querySelectorAll("button")).find((button) => button.textContent === "Finish");
      if (!finish) throw new Error("no Finish");
      await act(async () => { finish.click(); });
      expect(dom.container.querySelector("textarea")).not.toBeNull();
      await act(async () => { dom.root.render(desk(other)); });
      expect(dom.container.querySelector("textarea")).toBeNull();
    } finally {
      await dom.cleanup();
    }
  });
});

describe("the stand and the overnight promise on the desk", () => {
  test("the stand is one quiet line under the question, on a question topic with a stand", () => {
    expect(render(asQuestion)).toContain('class="desk-lead">Keep the team as it is and cut travel.');
    expect(render({ ...budgetThread, type: undefined })).toContain('class="desk-lead">Keep the team as it is and cut travel.');
    expect(render(asMaking)).not.toContain("Keep the team as it is and cut travel.");
    expect(render(asTopic)).not.toContain("Keep the team as it is and cut travel.");
  });

  test("an empty stand leaves the line out instead of the placeholder", () => {
    const html = render({ ...asQuestion, stand: "   " });
    expect(html).not.toContain('class="desk-lead"');
    expect(html).not.toContain("Still open.");
  });

  test("a topic asked for tonight shows one line at the top of the notes zone", () => {
    const html = render({ ...budgetThread, thinkTonight: true });
    expect(html).toContain('data-desk-promise="true"');
    expect(html).toContain("The assistant thinks about this topic overnight, a few notes at most.");
    expect(html.indexOf("overnight")).toBeLessThan(html.indexOf('class="eyebrow">The assistant&#x27;s notes'));
  });

  test("no promise line while thinking tonight is off", () => {
    expect(render()).not.toContain("overnight");
  });

  test("a closed topic shows no promise even while the flag is on", () => {
    expect(render({ ...closedThread, thinkTonight: true })).not.toContain("overnight");
  });

  test("the labels come from the German catalog", () => {
    const html = render({ ...budgetThread, thinkTonight: true }, "de");
    for (const label of ["Dieses Thema", "Heute Nacht darüber nachdenken", "Der Assistent denkt heute Nacht über dieses Thema nach", "Parken", "Abschliessen"]) {
      expect(html).toContain(label);
    }
  });
});

interface Wired {
  container: HTMLElement;
  cleanup: () => Promise<void>;
  button: (label: string) => HTMLButtonElement;
  click: (label: string) => Promise<void>;
  writes: { body: Record<string, unknown> }[];
  reads: string[];
  refreshed: () => number;
}

const neverEdited: Result<unknown> = { ok: true, data: { text: "", revision: "legacy-1", editable: true } };

async function mount(thread: StudioThread, reply: Answer = { ok: true, data: { message: "Done." } }, draft: Answer = neverEdited): Promise<Wired> {
  const dom = mountDom();
  let refreshed = 0;
  const client = createMemoryClient();
  client.seed("studio.act", reply);
  client.seed("studio.draft", draft);
  const writes = { get value() { return client.calls.filter((call) => call.name === "studio.act").map((call) => ({ body: call.args[0] as Record<string, unknown> })); } };
  const reads = { get value() { return client.calls.filter((call) => call.name === "studio.draft").map((call) => String(call.args[0])); } };
  await act(async () => {
    dom.root.render(
      <I18nProvider value={createI18n("en")}>
        <Desk client={client} refresh={() => { refreshed += 1; }} studio={studioList([thread])} slug={thread.slug} backLabel="Back" onBack={() => {}} now={NOW} />
      </I18nProvider>,
    );
  });
  const button = (label: string) => {
    const found = Array.from(dom.container.querySelectorAll("button")).find((candidate) => candidate.textContent === label);
    if (!found) throw new Error(`no button ${label}`);
    return found;
  };
  const click = async (label: string) => {
    await act(async () => { button(label).click(); });
  };
  return { container: dom.container, cleanup: dom.cleanup, button, click, get writes() { return writes.value; }, get reads() { return reads.value; }, refreshed: () => refreshed };
}

const field = (wired: Wired, selector: string): HTMLInputElement | HTMLTextAreaElement => {
  const found = wired.container.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
  if (!found) throw new Error(`no field ${selector}`);
  return found;
};

const chooseOutcome = async (wired: Wired, label: string) => {
  const choice = Array.from(wired.container.querySelectorAll("label.sttog")).find((candidate) => candidate.textContent === label);
  if (!choice) throw new Error(`no outcome ${label}`);
  const radio = choice.querySelector<HTMLInputElement>('input[type="radio"]');
  if (!radio) throw new Error(`no radio ${label}`);
  await act(async () => { radio.click(); });
};

describe("the acts through the Studio act client", () => {
  test("the switch sends think with on true, and again with on false once it is on", async () => {
    const off = await mount(budgetThread);
    try {
      const toggle = off.button("Think about it tonight");
      expect(toggle.getAttribute("role")).toBe("switch");
      expect(toggle.getAttribute("aria-checked")).toBe("false");
      await off.click("Think about it tonight");
      expect(off.writes).toHaveLength(1);
      expect(off.writes[0]?.body).toMatchObject({ act: "think", thread: budgetThread.slug, on: true });
    } finally {
      await off.cleanup();
    }

    const on = await mount({ ...budgetThread, thinkTonight: true });
    try {
      expect(on.button("Think about it tonight").getAttribute("aria-checked")).toBe("true");
      await on.click("Think about it tonight");
      expect(on.writes[0]?.body).toMatchObject({ act: "think", thread: budgetThread.slug, on: false });
    } finally {
      await on.cleanup();
    }
  });

  test("park sends park, and a parked topic sends unpark", async () => {
    const active = await mount(budgetThread);
    try {
      await active.click("Park");
      expect(active.writes[0]?.body).toMatchObject({ act: "park", thread: budgetThread.slug });
    } finally {
      await active.cleanup();
    }

    const parked = await mount({ ...budgetThread, state: "parked" });
    try {
      await parked.click("Take it up again");
      expect(parked.writes[0]?.body).toMatchObject({ act: "unpark", thread: budgetThread.slug });
    } finally {
      await parked.cleanup();
    }
  });

  test("finishing a question sends the decision, the expectation and the review date once the form holds them", async () => {
    const wired = await mount(asQuestion, { ok: true, data: { message: "Closed as decided." } });
    try {
      expect(wired.container.querySelector("textarea")).toBeNull();
      await wired.click("Finish");
      expect(wired.button("Close the topic").disabled).toBe(true);

      await inputText(field(wired, 'textarea[aria-label="The decision"]'), "We keep the team.");
      expect(wired.button("Close the topic").disabled).toBe(true);
      await inputText(field(wired, 'input[aria-label="What you expect to see if it was right"]'), "A lighter year.");
      expect(wired.button("Close the topic").disabled).toBe(true);
      await inputText(field(wired, 'input[type="date"]'), "2026-12-15");
      expect(wired.button("Close the topic").disabled).toBe(false);

      await wired.click("Close the topic");
      expect(wired.writes).toHaveLength(1);
      expect(wired.writes[0]?.body).toMatchObject({ act: "close", thread: budgetThread.slug, outcome: "decided", text: "We keep the team.", expect: "A lighter year.", reviewOn: "2026-12-15" });
      expect(wired.refreshed()).toBe(1);
    } finally {
      await wired.cleanup();
    }
  });

  test("finishing a making topic asks one line on what shipped and offers dropped", async () => {
    const wired = await mount(asMaking);
    try {
      await wired.click("Finish");
      expect(wired.container.querySelectorAll('input[type="radio"]')).toHaveLength(2);
      const text = field(wired, 'textarea[aria-label="What was shipped, in one line"]');
      await inputText(text, "The installer ships.");
      await wired.click("Close the topic");
      expect(wired.writes[0]?.body).toMatchObject({ act: "close", thread: budgetThread.slug, outcome: "shipped", text: "The installer ships." });
      expect(wired.writes[0]?.body.expect).toBeUndefined();
      expect(wired.writes[0]?.body.reviewOn).toBeUndefined();
    } finally {
      await wired.cleanup();
    }
  });

  test("finishing a topic-type thread offers all three outcomes", async () => {
    const wired = await mount(asTopic);
    try {
      await wired.click("Finish");
      expect(wired.container.querySelectorAll('input[type="radio"]')).toHaveLength(3);
      await chooseOutcome(wired, "Dropped");
      await inputText(field(wired, 'textarea[aria-label="Why it is dropped"]'), "The question answered itself.");
      await wired.click("Close the topic");
      expect(wired.writes[0]?.body).toMatchObject({ act: "close", thread: budgetThread.slug, outcome: "dropped", text: "The question answered itself." });
    } finally {
      await wired.cleanup();
    }
  });

  test("a refused act shows Cortex's message in the menu and keeps it open", async () => {
    const refused = "This topic is already on the assistant's list for tonight.";
    const wired = await mount(budgetThread, { ok: false, message: refused, status: 409 });
    try {
      await wired.click("Think about it tonight");
      expect(wired.container.textContent).toContain(refused);
      expect(wired.refreshed()).toBe(0);
    } finally {
      await wired.cleanup();
    }
  });

  test("a thread without a type finishes as a question", async () => {
    const wired = await mount({ ...budgetThread, type: undefined });
    try {
      await wired.click("Finish");
      const offered = Array.from(wired.container.querySelectorAll("label.sttog")).map((label) => label.textContent);
      expect(offered).toEqual(["Decided", "Dropped"]);
      await inputText(field(wired, 'textarea[aria-label="The decision"]'), "We keep the team.");
      await inputText(field(wired, 'input[aria-label="What you expect to see if it was right"]'), "A lighter year.");
      await inputText(field(wired, 'input[type="date"]'), "2026-12-15");
      await wired.click("Close the topic");
      expect(wired.writes[0]?.body).toMatchObject({ act: "close", thread: budgetThread.slug, outcome: "decided", text: "We keep the team.", expect: "A lighter year.", reviewOn: "2026-12-15" });
    } finally {
      await wired.cleanup();
    }
  });

  test("a refused close shows Cortex's message in the form and keeps what was typed", async () => {
    const refused = "The review date is in the past.";
    const wired = await mount(asQuestion, { ok: false, message: refused, status: 400 });
    try {
      await wired.click("Finish");
      await inputText(field(wired, 'textarea[aria-label="The decision"]'), "We keep the team.");
      await inputText(field(wired, 'input[aria-label="What you expect to see if it was right"]'), "A lighter year.");
      await inputText(field(wired, 'input[type="date"]'), "2020-01-01");
      await wired.click("Close the topic");
      expect(wired.container.textContent).toContain(refused);
      expect(field(wired, 'textarea[aria-label="The decision"]').value).toBe("We keep the team.");
      expect(wired.refreshed()).toBe(0);
    } finally {
      await wired.cleanup();
    }
  });
});

const savedDraft: Result<unknown> = { ok: true, data: { text: "Two days, no talks, one walk.", revision: "draft-7", editable: true } };

const conflict = (text: string): Result<unknown> => ({ ok: false, message: "The Studio draft changed or needs approval.", status: 409, body: { text, revision: "draft-9", error: "The Studio draft changed or needs approval." } });

describe("parking and finishing under Desk API 2", () => {
  test("a saved draft's revision travels with the park", async () => {
    const wired = await mount(budgetThread, { ok: true, data: { message: "Parked." } }, savedDraft);
    try {
      await wired.click("Park");
      expect(wired.reads).toEqual([budgetThread.slug]);
      expect(wired.writes[0]?.body).toEqual({ act: "park", thread: budgetThread.slug, draftRevision: "draft-7" });
      expect(wired.refreshed()).toBe(1);
    } finally {
      await wired.cleanup();
    }
  });

  test("a saved draft's revision travels with the close", async () => {
    const wired = await mount(asTopic, { ok: true, data: { message: "Closed." } }, savedDraft);
    try {
      await wired.click("Finish");
      await chooseOutcome(wired, "Dropped");
      await inputText(field(wired, 'textarea[aria-label="Why it is dropped"]'), "The question answered itself.");
      await wired.click("Close the topic");
      expect(wired.writes[0]?.body).toMatchObject({ act: "close", thread: budgetThread.slug, outcome: "dropped", draftRevision: "draft-7" });
    } finally {
      await wired.cleanup();
    }
  });

  test("a never-edited topic parks with the legacy revision Cortex computed, so every park carries one", async () => {
    const wired = await mount(budgetThread, { ok: true, data: { message: "Parked." } }, neverEdited);
    try {
      await wired.click("Park");
      expect(wired.writes[0]?.body).toEqual({ act: "park", thread: budgetThread.slug, draftRevision: "legacy-1" });
      expect(wired.refreshed()).toBe(1);
    } finally {
      await wired.cleanup();
    }
  });

  test("a topic whose draft Cortex cannot read parks without a revision", async () => {
    const wired = await mount(budgetThread, { ok: true, data: { message: "Parked." } }, { ok: false, message: null, status: 0 });
    try {
      await wired.click("Park");
      expect(wired.writes[0]?.body).toEqual({ act: "park", thread: budgetThread.slug });
      expect(wired.refreshed()).toBe(1);
    } finally {
      await wired.cleanup();
    }
  });

  test("a park carries the revision Threva read with the topic, not the one Cortex serves at the moment of the act", async () => {
    const later: Result<unknown> = { ok: true, data: { text: "A newer draft, saved elsewhere.", revision: "draft-9", editable: true } };
    let served = 0;
    const wired = await mount(budgetThread, { ok: true, data: { message: "Parked." } }, () => (served++ === 0 ? savedDraft : later));
    try {
      await wired.click("Park");
      expect(wired.reads).toEqual([budgetThread.slug]);
      expect(wired.writes[0]?.body).toEqual({ act: "park", thread: budgetThread.slug, draftRevision: "draft-7" });
    } finally {
      await wired.cleanup();
    }
  });

  test("a stale revision shows the draft as Cortex has it now and reports no success", async () => {
    const wired = await mount(budgetThread, conflict("A newer draft, saved elsewhere."), savedDraft);
    try {
      await wired.click("Park");
      const shown = wired.container.querySelector("[data-desk-draft]");
      expect(shown?.getAttribute("data-desk-draft")).toBe("changed");
      expect(shown?.textContent).toContain("The draft changed since Threva read it");
      expect(shown?.textContent).toContain("A newer draft, saved elsewhere.");
      expect(shown?.textContent).toContain("Draft revision draft-9");
      expect(wired.container.textContent).not.toContain("Parked.");
      expect(wired.refreshed()).toBe(0);
    } finally {
      await wired.cleanup();
    }
  });

  test("a park refused for a stale revision parks on the next try with the revision Cortex served", async () => {
    const refused = conflict("A newer draft, saved elsewhere.");
    const answers: Result<unknown>[] = [refused, { ok: true, data: { message: "Parked." } }];
    const wired = await mount(budgetThread, () => answers.shift() ?? refused, savedDraft);
    try {
      await wired.click("Park");
      expect(wired.writes[0]?.body).toEqual({ act: "park", thread: budgetThread.slug, draftRevision: "draft-7" });
      expect(wired.container.querySelector("[data-desk-draft]")?.textContent).toContain("Draft revision draft-9");
      await wired.click("Park");
      expect(wired.writes[1]?.body).toEqual({ act: "park", thread: budgetThread.slug, draftRevision: "draft-9" });
      expect(wired.reads).toEqual([budgetThread.slug]);
      expect(wired.refreshed()).toBe(1);
    } finally {
      await wired.cleanup();
    }
  });

  test("a stale revision on the close form shows the draft under the form and keeps what was typed", async () => {
    const wired = await mount(asQuestion, conflict(""), savedDraft);
    try {
      await wired.click("Finish");
      await inputText(field(wired, 'textarea[aria-label="The decision"]'), "We keep the team.");
      await inputText(field(wired, 'input[aria-label="What you expect to see if it was right"]'), "A lighter year.");
      await inputText(field(wired, 'input[type="date"]'), "2026-12-15");
      await wired.click("Close the topic");
      expect(wired.container.querySelector("[data-desk-draft]")?.textContent).toContain("The draft is empty.");
      expect(field(wired, 'textarea[aria-label="The decision"]').value).toBe("We keep the team.");
      expect(wired.refreshed()).toBe(0);
    } finally {
      await wired.cleanup();
    }
  });

  test("a refusal that arrives after the topic changed stays with the topic it was refused for", async () => {
    const dom = mountDom();
    const client = createMemoryClient();
    client.seed("studio.draft", (thread: string) => ({ ok: true, data: { text: "A draft.", revision: `draft-${thread}`, editable: true } }));
    let settle: (value: Result<unknown>) => void = () => {};
    const refused = new Promise<Result<unknown>>((resolve) => { settle = resolve; });
    let first = true;
    client.seed("studio.act", () => {
      if (!first) return { ok: true, data: { message: "Parked." } };
      first = false;
      return refused;
    });
    const page = (thread: string) => (
      <QueueContext.Provider value={{ client, refresh: () => {} }}>
        <ParkButton thread={thread} />
      </QueueContext.Provider>
    );
    const park = async () => {
      const button = dom.container.querySelector("button");
      if (!button) throw new Error("no Park");
      await act(async () => { button.click(); });
    };
    const writes = () => client.calls.filter((call) => call.name === "studio.act").map((call) => call.args[0]);
    try {
      await act(async () => { dom.root.render(page("first-topic")); });
      await park();
      await act(async () => { dom.root.render(page("second-topic")); });
      await act(async () => { settle(conflict("A newer draft, saved elsewhere.")); });
      await park();
      expect(writes()[0]).toEqual({ act: "park", thread: "first-topic", draftRevision: "draft-first-topic" });
      expect(writes()[1]).toEqual({ act: "park", thread: "second-topic", draftRevision: "draft-second-topic" });
    } finally {
      await dom.cleanup();
    }
  });
});

function ParkButton({ thread }: { thread: string }) {
  const { run } = useStudioAct(thread);
  return <button onClick={() => { void run({ act: "park", thread }); }}>Park</button>;
}
