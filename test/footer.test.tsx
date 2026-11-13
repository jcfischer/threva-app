import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { DeskAgents, DeskView, MailSweep } from "../src/ui/api/types";
import { Footer } from "../src/ui/day/footer";
import { createI18n, I18nProvider, type Locale } from "../src/ui/i18n";
import { item, NOW, view } from "./fixtures/desk";

const MIN = 60_000;

const sweep = (id: string): MailSweep => ({ id, kind: "newsletter", target: "archive", label: "Newsletters", title: "Newsletters", why: "Read none.", mails: [] });

const render = (desk: DeskView, opts: { locale?: Locale; open?: boolean } = {}) =>
  renderToStaticMarkup(
    <I18nProvider value={createI18n(opts.locale ?? "en")}>
      <Footer view={desk} now={NOW} defaultOpen={opts.open} />
    </I18nProvider>,
  );

const agents = (working: DeskAgents["working"]): DeskAgents => ({
  line: "Agents: 2 working, none waiting",
  working,
  waiting: 0,
});

describe("Footer", () => {
  const mails = [item({ key: "m1", kind: "mail" }), item({ key: "m2", kind: "mail" }), item({ key: "m3", kind: "mail" }), item({ key: "x", kind: "goal" })];

  test("the inbox line counts open mails and groups to let go", () => {
    const html = render(view({ items: mails, mailSweeps: [sweep("a")], mailDigests: [sweep("b")] }));
    expect(html).toContain("Inbox");
    expect(html).toContain("3 open mails · 2 groups to let go");
    expect(render(view({ items: mails.slice(0, 1), mailSweeps: [sweep("a")] }), { locale: "de" })).toContain("1 offene Mail · 1 Gruppe zum Weglegen");
  });

  test("with no mail and no groups the inbox is clear", () => {
    expect(render(view())).toContain("The inbox is clear.");
  });

  test("the routines line counts installed and waiting routines, and is absent without routines", () => {
    const routines = { installed: [{ title: "Morning mail" }, { title: "Weekly review" }], pending: [{ decisionId: "d1", impulseSummary: "A newsletter" }] };
    expect(render(view({ routines }))).toContain("Routines today</b> <span class=\"faint\">2 installed · 1 waiting for you");
    expect(render(view({ routines }), { locale: "de" })).toContain("2 eingerichtet · 1 wartet auf dich");
    expect(render(view())).not.toContain("Routines today");
    expect(render(view({ routines: null }))).not.toContain("Routines today");
  });

  test("the delegated line shows Cortex's line and a button to show the work", () => {
    const desk = view({ agents: agents([{ title: "Port the timeline", note: "in review", since: NOW - 75 * MIN }]) });
    const closed = render(desk);
    expect(closed).toContain("Delegated");
    expect(closed).toContain("Agents: 2 working, none waiting");
    expect(closed).toContain("Show delegated");
    expect(closed).not.toContain("Port the timeline");
  });

  test("open, the list shows title, note and how long ago each started, with Hide", () => {
    const desk = view({ agents: agents([{ title: "Port the timeline", note: "in review", since: NOW - 75 * MIN }, { title: "Sort mail", note: "", since: NOW - 5 * MIN }]) });
    const html = render(desk, { open: true });
    expect(html).toContain("Hide");
    expect(html).not.toContain("Show delegated");
    expect(html).toContain("Port the timeline</b> <span class=\"faint\">in review · started 1 h 15 min ago");
    expect(html).toContain("Sort mail</b> <span class=\"faint\">started 5 min ago");
    expect(render(desk, { open: true, locale: "de" })).toContain("in review · vor 1 Std. 15 Min. gestartet");
  });

  test("with no working agents there is no button", () => {
    const html = render(view({ agents: { line: "Agents: not connected", working: [], waiting: 0 } }), { open: true });
    expect(html).toContain("Agents: not connected");
    expect(html).not.toContain("Show delegated");
    expect(html).not.toContain("Hide");
  });
});
