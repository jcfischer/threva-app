import type { DeskView, MailRules, StudioList } from "./types";

export type Result<T> = { ok: true; data: T } | { ok: false; message: string | null; status: number };

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

async function readError(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as { error?: unknown; message?: unknown };
    if (typeof body.error === "string") return body.error;
    if (typeof body.message === "string") return body.message;
  } catch {}
  return null;
}

async function call<T>(fetchImpl: Fetch, path: string, init?: RequestInit): Promise<Result<T>> {
  let res: Response;
  try {
    res = await fetchImpl(path, init);
  } catch {
    return { ok: false, message: null, status: 0 };
  }
  if (!res.ok) return { ok: false, message: await readError(res), status: res.status };
  try {
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, message: null, status: res.status };
  }
}

export function newRequestId(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

export interface DeskClient {
  desk(): Promise<Result<DeskView>>;
  studio(): Promise<Result<StudioList>>;
  rules(): Promise<Result<MailRules>>;
  get<T = Record<string, unknown>>(path: string): Promise<Result<T>>;
  post<T = Record<string, unknown>>(path: string, body: unknown): Promise<Result<T>>;
}

export function createClient(fetchImpl: Fetch = (input, init) => fetch(input, init)): DeskClient {
  return {
    desk: () => call<DeskView>(fetchImpl, "/api/desk"),
    studio: () => call<StudioList>(fetchImpl, "/api/desk/studio"),
    rules: () => call<MailRules>(fetchImpl, "/api/desk/mail/rules"),
    get: <T,>(path: string) => call<T>(fetchImpl, path),
    post: <T,>(path: string, body: unknown) =>
      call<T>(fetchImpl, path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  };
}
