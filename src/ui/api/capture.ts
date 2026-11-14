import { newRequestId, type DeskClient, type Result } from "./client";

export const NOT_A_CARD = 422;

export interface Proposal {
  kind: string;
  label: string;
  fields: Record<string, unknown>;
  problem?: string;
  alternative?: { kind: "conversation"; label: string; fields: Record<string, unknown> };
  // Cortex marks a capture this way once studio.capture is granted: file it without the card.
  automatic?: boolean;
}

// Only a capture Cortex marked as automatic is filed at once. Every other proposal shows its card.
export function filesAtOnce(proposal: Proposal): boolean {
  return proposal.automatic === true && proposal.kind === "capture" && !proposal.problem;
}

export interface Created {
  id?: string | number;
  message?: string;
  url?: string;
}

export function propose(client: DeskClient, text: string): Promise<Result<{ proposal: Proposal }>> {
  return client.post<{ proposal: Proposal }>("/api/desk/ask", { text });
}

export function create(client: DeskClient, proposal: Proposal, requestId: string = newRequestId()): Promise<Result<Created>> {
  return client.post<Created>("/api/desk/create", { requestId, kind: proposal.kind, fields: proposal.fields });
}

export async function captureText(client: DeskClient, text: string): Promise<Result<Created>> {
  const asked = await propose(client, text);
  if (!asked.ok) return asked;
  const { proposal } = asked.data;
  if (proposal.kind === "conversation") return { ok: false, message: null, status: NOT_A_CARD };
  if (proposal.problem) return { ok: false, message: proposal.problem, status: 409 };
  return create(client, proposal);
}
