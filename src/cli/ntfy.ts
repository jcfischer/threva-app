import { isNtfyTopicUrl } from "./setup";

export interface NtfyDeps {
  stdin: () => Promise<string>;
  fetch: (url: string, init: RequestInit) => Promise<Response>;
}

interface PushRequest {
  title: string;
  why: string;
  action?: { label: string; url: string };
}

function parsePush(text: string): PushRequest | null {
  try {
    const value = JSON.parse(text) as Partial<PushRequest>;
    if (typeof value.title !== "string" || typeof value.why !== "string") return null;
    const action = value.action && typeof value.action.url === "string" && typeof value.action.label === "string" ? value.action : undefined;
    return { title: value.title, why: value.why, ...(action ? { action } : {}) };
  } catch {
    return null;
  }
}

/** Reads one Cortex push request on stdin and publishes it to an ntfy topic URL. */
export async function ntfy(argv: readonly string[], deps: NtfyDeps): Promise<{ code: number; error?: string }> {
  const topicUrl = argv[0];
  if (argv.length !== 1 || !topicUrl || !isNtfyTopicUrl(topicUrl)) return { code: 2, error: "Usage: threva ntfy <https://server/topic>" };
  const push = parsePush(await deps.stdin());
  if (!push) return { code: 1, error: "The push request on stdin has no title and why." };
  const url = new URL(topicUrl);
  const message = {
    topic: url.pathname.slice(1),
    title: push.title,
    message: push.why,
    ...(push.action ? { click: push.action.url, actions: [{ action: "view", label: push.action.label, url: push.action.url }] } : {}),
  };
  let response: Response;
  try {
    response = await deps.fetch(url.origin, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(message) });
  } catch (err) {
    return { code: 1, error: `ntfy did not answer: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (!response.ok) return { code: 1, error: `ntfy refused the push with HTTP ${response.status}.` };
  return { code: 0 };
}
