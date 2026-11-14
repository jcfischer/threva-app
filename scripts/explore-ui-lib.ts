import { join } from "node:path";

export interface ExploreArgs {
  url: string;
  spec: string;
  timeLimit: string;
  out: string;
}

export function parseExploreArgs(argv: readonly string[], env: Readonly<Record<string, string | undefined>>): { ok: true; value: ExploreArgs } | { ok: false; error: string } {
  const value: ExploreArgs = {
    url: `http://127.0.0.1:${env.THREVA_DEV_PORT ?? "8790"}/`,
    spec: "explore/threva.ts",
    timeLimit: "3m",
    out: env.THREVA_EXPLORE_OUT ?? join(".verify", "explore"),
  };
  const flags = { "--url": "url", "--spec": "spec", "--time-limit": "timeLimit", "--out": "out" } as const;
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i] ?? "";
    if (!Object.hasOwn(flags, flag)) return { ok: false, error: `Unknown option "${flag}". Options: ${Object.keys(flags).join(", ")}.` };
    if (i + 1 >= argv.length) return { ok: false, error: `${flag} needs a value.` };
    value[flags[flag as keyof typeof flags]] = argv[i + 1] ?? "";
  }
  if (!/^\d+[smhd]$/.test(value.timeLimit)) return { ok: false, error: `--time-limit takes a number with s, m, h or d, not "${value.timeLimit}".` };
  return { ok: true, value };
}
