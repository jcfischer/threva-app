import type { DeskClient, Result } from "./client";

export const NOT_A_CARD = 422;

export interface Proposal {
  kind: string;
  label: string;
  fields: Record<string, unknown>;
  problem?: string;
  alternative?: { kind: "conversation"; label: string; fields: Record<string, unknown> };
  automatic?: boolean;
}

export function filesAtOnce(proposal: Proposal): boolean {
  return proposal.automatic === true && proposal.kind === "capture" && !proposal.problem;
}

export interface Created {
  id?: string | number;
  message?: string;
  url?: string;
}

export function propose(client: DeskClient, text: string): Promise<Result<{ proposal: Proposal }>> {
  return client.capture.ask<{ proposal: Proposal }>(text);
}

export function create(client: DeskClient, proposal: Proposal, requestId?: string): Promise<Result<Created>> {
  return client.capture.create<Created>(proposal.kind, proposal.fields, requestId);
}

export async function captureText(client: DeskClient, text: string): Promise<Result<Created>> {
  const asked = await propose(client, text);
  if (!asked.ok) return asked;
  const { proposal } = asked.data;
  if (proposal.kind === "conversation") return { ok: false, message: null, status: NOT_A_CARD };
  if (proposal.problem) return { ok: false, message: proposal.problem, status: 409 };
  return create(client, proposal);
}
