import { expect, test } from "bun:test";
import { ntfy } from "../src/cli/ntfy";

const push = JSON.stringify({ key: "k1", title: "Budget call in 6 minutes", why: "Mail about a meeting later today", action: { label: "Join", url: "https://meet.example.org/budget" } });

test("publishes the push to the topic as ntfy JSON with a click action", async () => {
  const sent: { url: string; body: unknown }[] = [];
  const result = await ntfy(["https://ntfy.example.org/my-topic"], {
    stdin: async () => push,
    fetch: async (url, init) => {
      sent.push({ url, body: JSON.parse(init.body as string) });
      return new Response("{}", { status: 200 });
    },
  });
  expect(result).toEqual({ code: 0 });
  expect(sent).toEqual([{
    url: "https://ntfy.example.org",
    body: {
      topic: "my-topic",
      title: "Budget call in 6 minutes",
      message: "Mail about a meeting later today",
      click: "https://meet.example.org/budget",
      actions: [{ action: "view", label: "Join", url: "https://meet.example.org/budget" }],
    },
  }]);
});

test("a refused push exits non-zero with the HTTP status", async () => {
  const result = await ntfy(["https://ntfy.example.org/my-topic"], { stdin: async () => push, fetch: async () => new Response("", { status: 429 }) });
  expect(result).toEqual({ code: 1, error: "ntfy refused the push with HTTP 429." });
});

test("a topic URL that is not https is refused before anything is sent", async () => {
  const result = await ntfy(["http://ntfy.example.org/t"], { stdin: async () => push, fetch: async () => { throw new Error("must not send"); } });
  expect(result.code).toBe(2);
});
