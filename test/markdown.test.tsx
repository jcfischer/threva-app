import { afterEach, describe, expect, test } from "bun:test";
import { act, type ReactNode } from "react";
import { createMemoryClient } from "@desk/memory-client";
import { QueueContext } from "../src/ui/cards/act";
import { AssistantMargin, Margin } from "../src/ui/everything/margin";
import { createI18n, I18nProvider } from "../src/ui/i18n";
import { Markdown } from "../src/ui/markdown";
import { StudioCard } from "../src/ui/studio/card";
import { mountDom, type MountedDom } from "./fixtures/dom";
import { budgetThread, served } from "./fixtures/studio";

const REPLY = [
  "Two options:",
  "",
  "- **Hire** the designer first",
  "- Wait until [summer](https://example.com/plan) or [never](javascript:alert(1))",
  "",
  "Mail is <b>here</b> and `cut travel`.",
].join("\n");

let mounted: MountedDom | null = null;
afterEach(async () => {
  await mounted?.cleanup();
  mounted = null;
});

async function render(node: ReactNode): Promise<HTMLElement> {
  mounted = mountDom();
  const { root, container } = mounted;
  await act(async () => {
    root.render(
      <I18nProvider value={createI18n("en")}>
        <QueueContext.Provider value={{ client: createMemoryClient(), refresh: () => {} }}>{node}</QueueContext.Provider>
      </I18nProvider>,
    );
  });
  return container;
}

// The reply as Markdown: a list with bold text, a safe link opening in a new tab, the javascript: link as text, and the tag as text.
function expectFormatted(scope: Element) {
  const md = scope.querySelector(".md")!;
  expect(md).not.toBeNull();
  const items = [...md.querySelectorAll("ul > li")];
  expect(items.map((li) => li.textContent)).toEqual(["Hire the designer first", "Wait until summer or never"]);
  expect(md.querySelector("li strong")?.textContent).toBe("Hire");
  const links = [...md.querySelectorAll("a")];
  expect(links.map((a) => [a.textContent, a.getAttribute("href"), a.getAttribute("target"), a.getAttribute("rel")])).toEqual([["summer", "https://example.com/plan", "_blank", "noreferrer"]]);
  expect(md.innerHTML).not.toContain("javascript:");
  expect(md.querySelector("b")).toBeNull();
  expect(md.textContent).toContain("Mail is <b>here</b> and cut travel.");
  expect(md.querySelector("code")?.textContent).toBe("cut travel");
  expect(md.textContent).not.toContain("**");
}

describe("assistant text as Markdown", () => {
  test("a Studio note renders as Markdown", async () => {
    const note = { ...budgetThread.notes[0]!, text: REPLY };
    const thread = { ...budgetThread, notes: [note], derived: served([note]) };
    const container = await render(<StudioCard thread={thread} now={Date.parse("2026-11-14T12:00:00Z")} />);
    expectFormatted(container);
  });

  test("a margin note in the Everything view renders as Markdown", async () => {
    const note = { ...budgetThread.notes[0]!, text: REPLY };
    expectFormatted(await render(<Margin notes={[note]} slug="budget-next-year" name="Ivy" writable={false} />));
  });

  test("an outline-ask reply renders as Markdown", async () => {
    const note = { id: "n1", kind: "answer" as const, question: "What next?", passage: null, reply: REPLY, at: "2026-11-14T08:00:00Z" };
    const container = await render(<AssistantMargin notes={[note]} waiting={[]} tops={{}} page="" name="Ivy" onKeep={() => {}} onReplace={() => {}} onDismiss={() => {}} />);
    expectFormatted(container);
  });

  test("line breaks, headings, quotes and code blocks keep their shape", async () => {
    const text = "# Plan\nfirst\nsecond\n\n> quoted\n> on\n\n```\nlet a = 1;\n  b\n```\n\n3. three\n4. four";
    const container = await render(<Markdown text={text} />);
    const md = container.querySelector(".md")!;
    expect(md.querySelector("h4")?.textContent).toBe("Plan");
    expect(md.querySelector("h1,h2,h3")).toBeNull();
    expect(md.querySelector("p")?.innerHTML).toBe("first<br>second");
    expect(md.querySelector("blockquote p")?.innerHTML).toBe("quoted<br>on");
    expect(md.querySelector("pre code")?.textContent).toBe("let a = 1;\n  b");
    expect(md.querySelector("ol")?.getAttribute("start")).toBe("3");
  });

  test("reference-style links take their URL from the definition, which is not shown", async () => {
    const text = "See [the docs][Plan B] and [summer].\n\n[plan  b]: https://example.com/b\n[summer]: javascript:alert(1)";
    const md = (await render(<Markdown text={text} />)).querySelector(".md")!;
    expect([...md.querySelectorAll("a")].map((a) => [a.textContent, a.getAttribute("href")])).toEqual([["the docs", "https://example.com/b"]]);
    expect(md.textContent).toBe("See the docs and summer.");
  });

  test("an underlined heading drops its underline", async () => {
    const container = await render(<Markdown text={"Plan\n----\n\nbody"} />);
    expect(container.querySelector(".md h5")?.innerHTML).toBe("Plan");
  });
});
