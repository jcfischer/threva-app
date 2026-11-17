import { runOrReport } from "./run";

const MAX_INPUT_BYTES = 4095;

function quote(value: string): string {
  return '"' + value.replace(/[\\"]/g, "\\$&") + '"';
}

function keychainCommand(service: string, account: string, hex: string, update: boolean): string | null {
  if (/[\r\n\0]/.test(service) || /[\r\n\0]/.test(account)) return null;
  const command = `add-generic-password${update ? " -U" : ""} -s ${quote(service)} -a ${quote(account)} -X ${hex}\n`;
  return hex && Buffer.byteLength(command) <= MAX_INPUT_BYTES ? command : null;
}

export function mailKeychainInput(service: string, account: string, password: string, update = false): string | null {
  if (password.includes("\0")) return null;
  return keychainCommand(service, account, Buffer.from(password, "utf8").toString("hex"), update);
}

export function mailKeychainRestore(service: string, account: string, diagnostic: string): string | null {
  const hex = /^password: 0x((?:[a-f\d]{2})+)(?: |$)/im.exec(diagnostic)?.[1];
  if (hex) return keychainCommand(service, account, hex, true);
  const ascii = /^password: "(.*)"$/m.exec(diagnostic)?.[1];
  return ascii ? mailKeychainInput(service, account, ascii, true) : null;
}

export async function storeMailPassword(input: string, run = runOrReport): Promise<boolean> {
  const result = await run(["/usr/bin/security", "-i"], undefined, new Blob([input]));
  return result.status === 0;
}
