import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export function writeMailConfig(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const dir = mkdtempSync(join(dirname(path), ".mail-"));
  try {
    const temp = join(dir, "mail.json");
    writeFileSync(temp, text, { mode: 0o600 });
    renameSync(temp, path);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
