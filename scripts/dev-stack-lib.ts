import { join } from "node:path";

export const DEFAULT_PORT = 8790;

export interface DevStackPaths {
  cortexDir: string;
  adaptersDir: string;
  stateDir: string;
  uiDir: string;
  bun: string;
  port: number;
}

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

export function resolvePaths(
  env: Readonly<Record<string, string | undefined>>,
  repoDir: string,
  bun: string,
  exists: (path: string) => boolean,
): Checked<DevStackPaths> {
  const cortexDir = env.CORTEX_DIR;
  if (!cortexDir) return { ok: false, error: "Set CORTEX_DIR to a Cortex checkout that supports mc.ui.dir." };
  if (!exists(join(cortexDir, "src", "cortex.ts"))) return { ok: false, error: `CORTEX_DIR has no src/cortex.ts: ${cortexDir}` };
  const adaptersDir = env.CORTEX_ADAPTERS_DIR;
  if (!adaptersDir) return { ok: false, error: "Set CORTEX_ADAPTERS_DIR to a cortex-desk-adapters checkout." };
  if (!exists(join(adaptersDir, "bin", "desk-ics.ts"))) return { ok: false, error: `CORTEX_ADAPTERS_DIR has no bin/desk-ics.ts: ${adaptersDir}` };
  const home = env.HOME;
  const stateDir = env.THREVA_DEV_DIR ?? (home ? join(home, "work", "threva-dev") : undefined);
  if (!stateDir) return { ok: false, error: "Set THREVA_DEV_DIR to a directory for the dev stack's state." };
  const port = env.THREVA_DEV_PORT ? Number(env.THREVA_DEV_PORT) : DEFAULT_PORT;
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 8767) {
    return { ok: false, error: "THREVA_DEV_PORT must be a free port from 1024 to 65535, and not 8767." };
  }
  return { ok: true, value: { cortexDir, adaptersDir, stateDir, uiDir: join(repoDir, "dist", "ui"), bun, port } };
}

const q = (s: string) => JSON.stringify(s);

export function renderConfig(p: DevStackPaths): string {
  return [
    "principal: {id: threva-dev}",
    "stack: {id: threva-dev/dev}",
    "agents:",
    "  - {id: assistant, displayName: Threva Dev, persona: ./assistant.md, presence: {}}",
    "claude: {}",
    "mc:",
    "  enabled: true",
    `  port: ${p.port}`,
    `  dbPath: ${q(join(p.stateDir, "data", "mission-control.db"))}`,
    `  ui: {dir: ${q(p.uiDir)}}`,
    "  desk:",
    "    enabled: true",
    "    sources:",
    `      - {id: calendar, command: [${q(p.bun)}, ${q(join(p.adaptersDir, "bin", "desk-ics.ts"))}, ${q(join(p.stateDir, "sample", "calendar.ics"))}]}`,
    `      - {id: sample-mail, command: [/bin/cat, ${q(join(p.stateDir, "sample", "mail.json"))}]}`,
    `    studio: {dir: ${q(join(p.stateDir, "studio"))}}`,
    "    interruptions: {transport: none}",
    "",
  ].join("\n");
}

export function devEnv(stateDir: string, base: Readonly<Record<string, string | undefined>>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(base)) if (v !== undefined && k !== "NATS_URL" && k !== "MC_CONFIG_PATH") env[k] = v;
  const home = join(stateDir, "home");
  return {
    ...env,
    HOME: home,
    CORTEX_CONFIG_DIR: join(stateDir, "config"),
    CORTEX_STATE_DIR: join(stateDir, "state"),
    CORTEX_DATA_DIR: join(stateDir, "data"),
    CORTEX_EVENTS_DIR: join(stateDir, "data", "events"),
    CORTEX_PROCESSES_DIR: join(stateDir, "data", "processes"),
    XDG_CONFIG_HOME: join(home, ".config"),
    XDG_STATE_HOME: join(home, ".local", "state"),
    XDG_DATA_HOME: join(home, ".local", "share"),
  };
}

const MIN = 60_000;

function icsTime(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function vevent(uid: string, start: number, end: number, summary: string, extra: string[] = []): string[] {
  return ["BEGIN:VEVENT", `UID:${uid}`, `DTSTART:${icsTime(start)}`, `DTEND:${icsTime(end)}`, `SUMMARY:${summary}`, ...extra, "END:VEVENT"];
}

export function renderCalendar(now: number): string {
  const slot = Math.floor(now / MIN) * MIN;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//threva-app//dev-stack//EN",
    ...vevent("design-review@example.org", slot - 50 * MIN, slot - 15 * MIN, "Design review", ["LOCATION:Room 2"]),
    ...vevent("budget-call@example.org", slot + 6 * MIN, slot + 36 * MIN, "Budget call with Ada", ["URL:https://meet.example.org/budget"]),
    ...vevent("team-sync@example.org", slot + 3 * 60 * MIN, slot + 3 * 60 * MIN + 30 * MIN, "Team sync", ["LOCATION:Room 1"]),
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function renderMail(now: number): string {
  const ago = (min: number) => new Date(now - min * MIN).toISOString();
  const mail = (id: string, name: string, address: string, subject: string, min: number, firstParagraph: string) => ({
    kind: "mail",
    id,
    from: { name, address },
    subject,
    receivedAt: ago(min),
    unread: true,
    firstParagraph,
    account: "example",
  });
  return `${JSON.stringify(
    {
      items: [
        mail("budget-2027@example.org", "Ada Lovelace", "ada@example.org", "Budget for next year", 40, "Could you look at the budget draft before our call?"),
        mail("offsite@example.org", "Grace Hopper", "grace@example.org", "Offsite in March", 180, "Which of the two weeks works for your team?"),
        mail("invoice-1142@example.org", "Billing", "billing@example.net", "Invoice 1142", 600, "Your invoice for October is attached."),
      ],
    },
    null,
    2,
  )}\n`;
}
