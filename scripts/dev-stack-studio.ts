import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface StudioFile {
  path: string;
  text: string;
}

export const STUDIO_AREA = { id: "work", label: "Work" } as const;

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

const isoTime = (ms: number): string => new Date(Math.floor(ms / 1000) * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
const isoDate = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

interface Note {
  at: number;
  text: string;
}

interface Response {
  at: number;
  re: number;
  text: string;
}

interface SampleThread {
  slug: string;
  opened: number;
  question: string;
  stand: string;
  notes: Note[];
  responses: Response[];
  material: string[];
}

function renderThread(t: SampleThread): StudioFile {
  const lines = [
    "---",
    "type: question",
    `areas: [${STUDIO_AREA.id}]`,
    "state: active",
    `opened: ${isoDate(t.opened)}`,
    "---",
    "",
    "## Question",
    "",
    t.question,
    "",
    "## Where I stand",
    "",
    t.stand,
    "",
    "## Ivy's notes",
    "",
    ...t.notes.flatMap((n) => [`### ${isoTime(n.at)}`, "trigger: Sample thread", "model: sample", "sample: true", "", n.text, ""]),
    "## Material",
    "",
    ...t.material.map((m) => `- ${m}`),
    "",
    "## Log",
    "",
    `- ${isoDate(t.opened)}: Opened`,
    "",
  ];
  if (t.responses.length) {
    lines.push("## Responses", "", ...t.responses.flatMap((r) => [`### ${isoTime(r.at)}`, `re: ${isoTime(r.re)}`, "", r.text, ""]));
  }
  return { path: `threads/${t.slug}.md`, text: lines.join("\n") };
}

export function renderStudioThreads(now: number): StudioFile[] {
  const waitingNote = now - 2 * 60 * MIN;
  const answeredNote = now - 2 * DAY;
  return [
    renderThread({
      slug: "budget-next-year",
      opened: now - 6 * DAY,
      question: "What goes into next year's budget?",
      stand: "Keep the team as it is and cut travel.",
      notes: [{ at: waitingNote, text: "Ada's draft adds two hires. Does cutting travel still cover them, or does one hire wait until summer?" }],
      responses: [],
      material: ["person: Ada Lovelace", "mail: Budget for next year"],
    }),
    renderThread({
      slug: "offsite-in-march",
      opened: now - 9 * DAY,
      question: "What is the March offsite for?",
      stand: "Two days to plan the year, no talks.",
      notes: [{ at: answeredNote, text: "Grace asks which of the two weeks works. The first week clashes with the budget review." }],
      responses: [{ at: answeredNote + 3 * 60 * MIN, re: answeredNote, text: "The second week. I told Grace." }],
      material: ["person: Grace Hopper", "mail: Offsite in March"],
    }),
  ];
}

export type Git = (args: string[], cwd: string) => { exitCode: number; stderr: string };

const IDENTITY = [
  ["user.name", "Threva dev"],
  ["user.email", "threva-dev@example.invalid"],
  ["commit.gpgsign", "false"],
] as const;

export function seedStudio(dir: string, now: number, git: Git): { seeded: boolean; error?: string } {
  mkdirSync(dir, { recursive: true });
  if (existsSync(join(dir, ".git")) && git(["rev-parse", "--verify", "-q", "HEAD"], dir).exitCode === 0) return { seeded: false };
  const steps: string[][] = [["init", "-q"], ...IDENTITY.map(([k, v]) => ["config", k, v])];
  for (const args of steps) {
    const r = git(args, dir);
    if (r.exitCode !== 0) return { seeded: false, error: `git ${args.join(" ")} failed: ${r.stderr.trim()}` };
  }
  for (const file of renderStudioThreads(now)) {
    const path = join(dir, file.path);
    mkdirSync(dirname(path), { recursive: true });
    if (!existsSync(path)) writeFileSync(path, file.text);
  }
  for (const args of [["add", "-A"], ["commit", "-q", "-m", "Studio: sample threads for the dev stack"]]) {
    const r = git(args, dir);
    if (r.exitCode !== 0) return { seeded: false, error: `git ${args.join(" ")} failed: ${r.stderr.trim()}` };
  }
  return { seeded: true };
}
