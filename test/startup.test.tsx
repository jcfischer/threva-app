import { expect, test } from "bun:test";
import { act } from "react";
import { createMemoryClient, type MemoryClient } from "@desk/memory-client";
import { App } from "../src/ui/app";
import { createI18n, I18nProvider, type Locale } from "../src/ui/i18n";
import { item, seededApp, view } from "./fixtures/desk";
import { mountDom, type MountedDom } from "./fixtures/dom";

const t = createI18n("en").t;

async function open(client: MemoryClient, locale: Locale = "en"): Promise<MountedDom> {
  const dom = mountDom();
  await act(async () => dom.root.render(
    <I18nProvider value={createI18n(locale)}>
      <App client={client} />
    </I18nProvider>,
  ));
  return dom;
}

const arrived = () => view({ items: [item({ key: "m1", kind: "mail", title: "A mail that needs you" })] });

test("a Cortex of the same major version loads the desk as today", async () => {
  const client = createMemoryClient();
  client.seed("handshake", { ok: true, data: { version: "1.9.4" } });
  seededApp(client, { desk: arrived() });
  const dom = await open(client);
  try {
    expect(dom.container.textContent).toContain("A mail that needs you");
    expect(client.calls.map((call) => call.name)).toContain("desk");
  } finally {
    await dom.cleanup();
  }
});

test("a Cortex of another major version is refused with one message naming both versions", async () => {
  const client = createMemoryClient();
  client.seed("handshake", { ok: true, data: { version: "2.1.0" } });
  seededApp(client, { desk: arrived() });
  const dom = await open(client);
  try {
    const alerts = dom.container.querySelectorAll('[role="alert"]');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.textContent).toBe(t("startup.version", { built: "1", found: "2.1.0" }));
    expect(alerts[0]?.textContent).toContain("2.1.0");
    expect(client.calls.map((call) => call.name)).toEqual(["handshake"]);
  } finally {
    await dom.cleanup();
  }
});

test("a handshake with no answer shows the network error and makes no desk call", async () => {
  const client = createMemoryClient();
  client.seed("handshake", { ok: false, message: null, status: 0 });
  seededApp(client, { desk: arrived() });
  const dom = await open(client);
  try {
    expect(dom.container.textContent).toContain(t("error.network"));
    expect(dom.container.textContent).not.toContain("A mail that needs you");
    expect(client.calls.map((call) => call.name)).toEqual(["handshake"]);
  } finally {
    await dom.cleanup();
  }
});

test("a failed desk load with a working handshake shows the same network error", async () => {
  const client = createMemoryClient();
  seededApp(client);
  client.seed("desk", { ok: false, message: null, status: 0 });
  const dom = await open(client);
  try {
    expect(dom.container.textContent).toContain(t("error.network"));
  } finally {
    await dom.cleanup();
  }
});
