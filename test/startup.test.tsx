import { expect, test } from "bun:test";
import { act } from "react";
import { createMemoryClient, type MemoryClient } from "@desk/memory-client";
import { App } from "../src/ui/app";
import { createI18n, I18nProvider, type Locale } from "../src/ui/i18n";
import { useStartup } from "../src/ui/queue/use-startup";
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

function Probe({ client, retryMs }: { client: MemoryClient; retryMs: number }) {
  const startup = useStartup(client, retryMs);
  return <p data-state={startup.state} />;
}

async function waitFor(dom: MountedDom, ms: number): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

const arrived = () => view({ items: [item({ key: "m1", kind: "mail", title: "A mail that needs you" })] });

test("a Cortex of the same major version loads the desk as today", async () => {
  const client = createMemoryClient();
  client.seed("contract", { ok: true, data: { version: "1.9.4" } });
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
  client.seed("contract", { ok: true, data: { version: "2.1.0" } });
  seededApp(client, { desk: arrived() });
  const dom = await open(client);
  try {
    const alerts = dom.container.querySelectorAll('[role="alert"]');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.textContent).toBe(t("startup.version", { built: "1", found: "2.1.0" }));
    expect(alerts[0]?.textContent).toContain("2.1.0");
    expect(client.calls.map((call) => call.name)).toEqual(["contract"]);
  } finally {
    await dom.cleanup();
  }
});

test("a contract with no answer shows the network error and makes no desk call", async () => {
  const client = createMemoryClient();
  client.seed("contract", { ok: false, message: null, status: 0 });
  seededApp(client, { desk: arrived() });
  const dom = await open(client);
  try {
    expect(dom.container.textContent).toContain(t("error.network"));
    expect(dom.container.textContent).not.toContain("A mail that needs you");
    expect(client.calls.length).toBeGreaterThan(0);
    expect(client.calls.every((call) => call.name === "contract")).toBe(true);
  } finally {
    await dom.cleanup();
  }
});

test("a contract with no answer is asked again until Cortex answers", async () => {
  const client = createMemoryClient();
  client.seed("contract", { ok: false, message: null, status: 0 });
  const dom = mountDom();
  const shown = () => dom.container.querySelector("[data-state]")?.getAttribute("data-state");
  await act(async () => dom.root.render(<Probe client={client} retryMs={5} />));
  try {
    expect(shown()).toBe("failed");
    const attempts = client.calls.length;
    client.seed("contract", { ok: true, data: { version: "1.2.3" } });
    await waitFor(dom, 60);
    expect(shown()).toBe("ready");
    expect(client.calls.length).toBeGreaterThan(attempts);
  } finally {
    await dom.cleanup();
  }
});

test("a contract Cortex answers with an HTTP error says so and makes no desk call", async () => {
  const client = createMemoryClient();
  client.seed("contract", { ok: false, message: null, status: 404 });
  seededApp(client, { desk: arrived() });
  const dom = await open(client);
  try {
    expect(dom.container.textContent).toContain(t("startup.contract"));
    expect(dom.container.textContent).not.toContain("A mail that needs you");
    expect(client.calls.every((call) => call.name === "contract")).toBe(true);
  } finally {
    await dom.cleanup();
  }
});

test("a contract without a version shows the contract error instead of checking forever", async () => {
  const client = createMemoryClient();
  client.seed("contract", { ok: true, data: {} });
  seededApp(client, { desk: arrived() });
  const dom = await open(client);
  try {
    expect(dom.container.textContent).toContain(t("startup.contract"));
    expect(dom.container.textContent).not.toContain("A mail that needs you");
  } finally {
    await dom.cleanup();
  }
});

test("a failed desk load with a working contract shows the same network error", async () => {
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
