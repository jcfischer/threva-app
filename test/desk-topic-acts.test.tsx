import { describe, expect, test } from "bun:test";
import { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createClient, type Fetch } from "../src/ui/api/client";
import type { StudioThread } from "../src/ui/api/types";
import { Desk } from "../src/ui/desk/desk";
import { closeAct, outcomesFor, standLine, threadType } from "../src/ui/desk/topic-menu";
import { createI18n, I18nProvider } from "../src/ui/i18n";
import { STUDIO_ACT_PATH } from "../src/ui/studio/act";
import { inputText, mountDom } from "./fixtures/dom";
import { budgetThread, closedThread, studioList } from "./fixtures/studio";

const NOW = Date.parse("2026-11-14T12:00:00Z");
const noFetch: Fetch = async () => new Response("{}");

const asQuestion = { ...budgetThread, type: "question" as const };
const asMaking: StudioThread = { ...budgetThread, type: "making" };
const asTopic: StudioThread = { ...budgetThread, type: "topic" };

const render = (thread: StudioThread = budgetThread, locale: "en" | "de" = "en") =>
  renderToStaticMarkup(
    <I18nProvider value={createI18n(locale)}>
      <Desk client={createClient(noFetch)} studio={studioList([thread])} slug={thread.slug} backLabel="Back" onBack={() => {}} now={NOW} />
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
  writes: { path: string; body: Record<string, unknown> }[];
  refreshed: () => number;
}

async function mount(thread: StudioThread, reply: (body: Record<string, unknown>) => Response = () => Response.json({ ok: true, message: "Done." })): Promise<Wired> {
  const dom = mountDom();
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  let refreshed = 0;
  const client = createClient(async (path, init) => {
    const body = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as Record<string, unknown>;
    writes.push({ path, body });
    return reply(body);
  });
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
  return { container: dom.container, cleanup: dom.cleanup, button, click, writes, refreshed: () => refreshed };
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
      expect(off.writes[0]?.path).toBe(STUDIO_ACT_PATH);
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
    const wired = await mount(asQuestion, () => Response.json({ ok: true, message: "Closed as decided." }));
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

  test("finishing a topic offers all three outcomes", async () => {
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
    const wired = await mount(budgetThread, () => Response.json({ error: refused }, { status: 409 }));
    try {
      await wired.click("Think about it tonight");
      expect(wired.container.textContent).toContain(refused);
      expect(wired.refreshed()).toBe(0);
    } finally {
      await wired.cleanup();
    }
  });

  test("a refused close shows Cortex's message in the form and keeps what was typed", async () => {
    const refused = "The review date is in the past.";
    const wired = await mount(asQuestion, () => Response.json({ error: refused }, { status: 400 }));
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
