import { runOrReport } from "./run";

const MAX_INPUT_BYTES = 4095;

function quote(value: string): string {
  return '"' + value.replace(/[\\"]/g, "\\$&") + '"';
}

export function mailKeychainInput(service: string, account: string, password: string): string | null {
  if (/[\r\n\0]/.test(service) || /[\r\n\0]/.test(account) || password.includes("\0")) return null;
  const hex = Buffer.from(password, "utf8").toString("hex");
  const command = `add-generic-password -s ${quote(service)} -a ${quote(account)} -X ${hex}\n`;
  return hex && Buffer.byteLength(command) <= MAX_INPUT_BYTES ? command : null;
}

export async function storeMailPassword(input: string, run = runOrReport): Promise<boolean> {
  const result = await run(["/usr/bin/security", "-i"], undefined, new Blob([input]));
  return result.status === 0;
}
