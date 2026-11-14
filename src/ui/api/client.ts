import type { DeskView, MailRules, MyDayOutline, OutlineCommand, StudioList } from "./types";

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

function jsonPost<T>(fetchImpl: Fetch, path: string, body: unknown): Promise<Result<T>> {
  return call<T>(fetchImpl, path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

export interface DeskClient {
  desk(): Promise<Result<DeskView>>;
  studio(): Promise<Result<StudioList>>;
  rules(): Promise<Result<MailRules>>;
  myDay(): Promise<Result<MyDayOutline>>;
  changeOutline(date: string, command: OutlineCommand): Promise<Result<{ view: MyDayOutline }>>;
  post<T = Record<string, unknown>>(path: string, body: unknown): Promise<Result<T>>;
}

export function createClient(fetchImpl: Fetch = (input, init) => fetch(input, init)): DeskClient {
  return {
    desk: () => call<DeskView>(fetchImpl, "/api/desk"),
    studio: () => call<StudioList>(fetchImpl, "/api/desk/studio"),
    rules: () => call<MailRules>(fetchImpl, "/api/desk/mail/rules"),
    myDay: () => call<MyDayOutline>(fetchImpl, "/api/desk/my-day"),
    changeOutline: (date, command) => jsonPost<{ view: MyDayOutline }>(fetchImpl, "/api/desk/my-day", { date, requestId: crypto.randomUUID(), command }),
    post: <T,>(path: string, body: unknown) =>
      jsonPost<T>(fetchImpl, path, body),
  };
}
