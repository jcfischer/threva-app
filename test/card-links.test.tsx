import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createClient } from "../src/ui/api/client";
import { QueueContext } from "../src/ui/cards/act";
import { MailCard } from "../src/ui/cards/mail-cards";
import { MeetingSoonCard } from "../src/ui/cards/meeting-cards";
import { ItemCard } from "../src/ui/cards/queue-cards";
import { createI18n, I18nProvider } from "../src/ui/i18n";
import { item, NOW } from "./fixtures/desk";

const wrap = (node: React.ReactNode) =>
  renderToStaticMarkup(
    <I18nProvider value={createI18n("en")}>
      <QueueContext.Provider value={{ client: createClient(async () => new Response("{}")), refresh: () => {} }}>{node}</QueueContext.Provider>
    </I18nProvider>,
  );

const bad = "javascript:alert(1)";
const action = { id: "open", label: "Open", role: "primary" as const, wired: true, url: bad };

test("no card renders a javascript: link from Cortex data", () => {
  const html = [
    wrap(<ItemCard item={item({ key: "i", kind: "sensor", actions: [action] })} fresh={false} />),
    wrap(<MeetingSoonCard item={item({ key: "m", kind: "meeting", actions: [action] })} event={{ key: "e", at: NOW, end: NOW + 1, title: "Call", kind: "meeting", url: bad }} />),
    wrap(<MailCard item={item({ key: "mail", kind: "mail", actions: [action], detail: { summary: "", links: [{ label: "x", url: bad }] } })} />),
  ].join("");
  expect(html).not.toContain("javascript:");
});

test("a safe link after a bad one still renders on every card", () => {
  const ok = { ...action, id: "open", url: "https://ok.example/" };
  expect(wrap(<ItemCard item={item({ key: "i", kind: "sensor", actions: [action, { ...ok, id: "o2" }] })} fresh={false} />)).toContain('href="https://ok.example/"');
  expect(wrap(<MeetingSoonCard item={item({ key: "m", kind: "meeting", actions: [action] })} event={{ key: "e", at: NOW, end: NOW + 1, title: "Call", kind: "meeting", url: "https://ok.example/" }} />)).toContain('href="https://ok.example/"');
  const mail = wrap(<MailCard item={item({ key: "mail", kind: "mail", detail: { summary: "", links: [{ label: "x", url: bad }, { label: "y", url: "message:%3Cid@example.org%3E" }] } })} />);
  expect(mail).toContain('href="message:%3Cid@example.org%3E"');
});
