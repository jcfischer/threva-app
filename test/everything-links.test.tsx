import { afterEach, expect, test } from "bun:test";
import { act } from "react";
import { EditorView } from "@codemirror/view";
import { createClient } from "../src/ui/api/client";
import { pathTo } from "../src/ui/everything/moves";
import { NotePage } from "../src/ui/everything/page";
import { createI18n, I18nProvider } from "../src/ui/i18n";
import { EverythingView } from "../src/ui/everything/view";
import { outlineFixture, row } from "./fixtures/outline";
import { CODEMIRROR_GLOBALS, mountDom } from "./fixtures/dom";

const FORUM = "https://forums.developer.nvidia.com/t/lets-optimize-dgx-spark/387929/4";
const MAIL = "message://%3Cid@example.org%3E";
const WIKI = "https://en.wikipedia.org/wiki/Spark_(software)";

let close: (() => Promise<void>) | null = null;
afterEach(async () => {
  await close?.();
  close = null;
});

function mount(globals: readonly string[] = []) {
  const mounted = mountDom(globals);
  close = mounted.cleanup;
  return { container: mounted.container, render: async (node: React.ReactNode) => { await act(async () => mounted.root.render(node)); } };
}

function linkedDay() {
  const day = outlineFixture();
  const exercise = pathTo(day.outline, "project")!.at(-1)!;
  exercise.children.unshift(
    row("spark", { title: `The DGX Spark can be power tuned: ${FORUM}` }),
    row("bare", { title: FORUM }),
    row("tricky", { title: "Read javascript:alert(1) and ftp://files.example later" }),
  );
  return day;
}

const click = async (container: Element, text: string) => {
  const button = Array.from(container.querySelectorAll("button")).find(el => el.textContent === text);
  expect(button).toBeDefined();
  await act(async () => button!.click());
};

test("a URL in a row title is a link in the outline and on the opened row; other titles stay one button", async () => {
  const { container, render } = mount();
  await render(<EverythingView client={createClient()} initialDay={linkedDay()} />);
  await click(container, "Work");
  await click(container, "Exercise");

  const spark = container.querySelector('[data-row="spark"] .outline-title')!;
  expect(spark.textContent).toBe(`The DGX Spark can be power tuned: ${FORUM}`);
  const link = spark.querySelector("a")!;
  expect(link.getAttribute("href")).toBe(FORUM);
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toBe("noreferrer");

  // A title that is only a URL still has a way to open its row.
  expect(container.querySelector('[data-row="bare"] .outline-title a')?.getAttribute("href")).toBe(FORUM);
  expect(container.querySelector('[data-row="bare"] .outline-title button')?.textContent).toBe("Open");

  // Without an http or https URL, the title is the one button it was, and nothing else becomes a link.
  for (const id of ["due", "tricky"]) {
    const title = container.querySelector(`[data-row="${id}"] .outline-title`)!;
    expect(title.tagName).toBe("BUTTON");
    expect(title.querySelector("a")).toBeNull();
  }

  await click(container, "The DGX Spark can be power tuned: ");
  const heading = container.querySelector(".cur h2")!;
  expect(heading.textContent).toBe(`The DGX Spark can be power tuned: ${FORUM}`);
  expect(heading.querySelector("a")?.getAttribute("href")).toBe(FORUM);
  expect(heading.querySelector("a")?.getAttribute("target")).toBe("_blank");
});

test("links on a page open with a plain click when not writing and with Cmd- or Ctrl-click while writing", async () => {
  const { container, render } = mount(CODEMIRROR_GLOBALS);
  const opened: string[] = [];
  window.open = ((url?: string | URL) => { opened.push(String(url)); return null; }) as typeof window.open;
  const note = `From work-mail: mail:abc\n${MAIL}\n\nThe [forum thread](${FORUM}) and https://threva.example/a. See [the wiki](${WIKI}) (or ${WIKI}).`;
  await render(<I18nProvider value={createI18n("en")}><NotePage row={row("mail", { title: "Answer the mail", note })} text={note} place={null} notice={null} onType={() => {}} onLeave={() => {}} /></I18nProvider>);
  const content = container.querySelector(".cm-content") as HTMLElement;
  const editor = EditorView.findFromDOM(content)!;

  const links = () => [...container.querySelectorAll(".cm-note-link")];
  expect([...new Set(links().map(link => link.getAttribute("data-href")))]).toEqual([MAIL, FORUM, "https://threva.example/a", WIKI]);
  expect(links()[0]!.getAttribute("title")).toMatch(/^Click to open, or (⌘|Ctrl)-click while you write$/);
  // A bare URL stays on the page when the cursor is elsewhere; a Markdown link shows its label.
  expect(content.textContent).toContain("https://threva.example/a.");
  expect(content.textContent).toContain("The forum thread and");

  const press = async (href: string, init: MouseEventInit = {}) => {
    const target = links().find(link => link.getAttribute("data-href") === href)!;
    await act(async () => { target.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0, ...init }) as unknown as Event); });
  };

  await press(MAIL);
  await press(FORUM);
  expect(opened).toEqual([MAIL, FORUM]);

  await act(async () => content.focus());
  expect(editor.hasFocus).toBe(true);
  await press(FORUM);
  expect(opened).toHaveLength(2);
  await press(FORUM, { metaKey: true });
  await press(MAIL, { ctrlKey: true });
  expect(opened).toEqual([MAIL, FORUM, FORUM, MAIL]);
});

test("a title split by a URL is one tab stop plus its link: only its first text is reachable by Tab", async () => {
  const day = outlineFixture();
  pathTo(day.outline, "project")!.at(-1)!.children.unshift(row("split", { title: `Before ${FORUM} after` }));
  const { container, render } = mount();
  await render(<EverythingView client={createClient()} initialDay={day} />);
  await click(container, "Work");
  await click(container, "Exercise");

  const title = container.querySelector('[data-row="split"] .outline-title')!;
  const texts = Array.from(title.querySelectorAll("button"));
  expect(texts.map(button => button.textContent)).toEqual(["Before ", " after"]);
  expect(texts.map(button => button.getAttribute("tabindex"))).toEqual([null, "-1"]);
  expect(title.querySelector("a")?.getAttribute("tabindex")).toBeNull();
});
