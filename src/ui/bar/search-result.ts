import type { DeskClient, DeskSearchHit, Result } from "@desk/client";

export async function openSearchHit(client: DeskClient, hit: DeskSearchHit): Promise<Result<string>> {
  if (hit.kind === "desk-note" || hit.kind === "desk-item") {
    const response = await client.desk();
    if (!response.ok) return response;
    const { notes, items } = response.data;
    const text = hit.kind === "desk-note"
      ? notes?.find((note) => String(note.id) === hit.id)?.text
      : items.find((item) => item.key === hit.id)?.detail.summary;
    return { ok: true, data: text ?? hit.snippet };
  }
  const response = await client.studio.list();
  if (!response.ok) return response;
  const { studio } = response.data;
  if (hit.kind === "studio-capture") {
    const capture = studio?.inbox?.find(({ id, path }) => id === hit.id || path === hit.id);
    return { ok: true, data: capture?.text ?? hit.snippet };
  }
  const thread = [...(studio?.active ?? []), ...(studio?.parked ?? []), ...(studio?.closed ?? [])].find(({ slug }) => slug === hit.id);
  return { ok: true, data: [thread?.stand, thread?.outcomeText].filter(Boolean).join("\n\n") || hit.snippet };
}
