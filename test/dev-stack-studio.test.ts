import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderStudioThreads, seedStudio, STUDIO_AREA, type Git } from "../scripts/dev-stack-studio";
import type { StudioNote } from "../src/ui/api/types";
import { threadWaits } from "../src/ui/queue/order";

const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;
const SECTIONS = new Set(["question", "where i stand", "ivy's notes", "material", "log", "outcome", "responses"]);

interface Parsed {
  front: Record<string, string>;
  sections: Map<string, string>;
}

function parse(text: string): Parsed {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!m?.[1]) throw new Error("no front matter");
  const front = Object.fromEntries(m[1].split("\n").map((l) => [l.slice(0, l.indexOf(":")), l.slice(l.indexOf(":") + 1).trim()]));
  const sections = new Map<string, string>();
  let current: string | null = null;
  for (const line of text.slice(m[0].length).split("\n")) {
    if (line.startsWith("## ")) {
      current = line.slice(3).trim().toLowerCase();
      if (sections.has(current)) throw new Error(`section ${current} twice`);
      sections.set(current, "");
    } else if (current) sections.set(current, `${sections.get(current)}${line}\n`);
  }
  return { front, sections };
}

function entries(text: string, meta: RegExp): { at: string; meta: Record<string, string>; text: string }[] {
  return text
    .split(/^### /m)
    .slice(1)
    .map((block) => {
      const [heading = "", ...lines] = block.split("\n");
      const fields: Record<string, string> = {};
      let i = 0;
      for (; i < lines.length; i++) {
        const f = meta.exec(lines[i] ?? "");
        if (!f?.[1]) break;
        fields[f[1]] = f[2] ?? "";
      }
      return { at: heading.trim(), meta: fields, text: lines.slice(i).join("\n").trim() };
    });
}

const NOTE_META = /^(trigger|model|mode|run|kind|status|sample|because|relates):[ \t]*(.*)$/;
const RESPONSE_META = /^(re):[ \t]*(.*)$/;

function asThread(slug: string, p: Parsed) {
  const notes = entries(p.sections.get("ivy's notes") ?? "", NOTE_META).map((n) => ({ at: n.at, kind: (n.meta.kind ?? "note") as StudioNote["kind"], status: (n.meta.status ?? "open") as StudioNote["status"], text: n.text, trigger: n.meta.trigger, model: n.meta.model }));
  const responses = entries(p.sections.get("responses") ?? "", RESPONSE_META).map((r) => ({ at: r.at, re: r.meta.re, text: r.text }));
  return { slug, question: (p.sections.get("question") ?? "").trim(), stand: (p.sections.get("where i stand") ?? "").trim(), notes, responses };
}

describe("renderStudioThreads", () => {
  const now = Date.parse("2026-11-13T16:00:30.500Z");
  const files = renderStudioThreads(now);
  const threads = files.map((f) => {
    const slug = /^threads\/([a-z0-9][a-z0-9-]*)\.md$/.exec(f.path)?.[1];
    if (!slug) throw new Error(`not a thread path: ${f.path}`);
    return { file: f, parsed: parse(f.text), thread: asThread(slug, parse(f.text)) };
  });

  test("writes two thread files in Cortex's Studio format", () => {
    expect(threads.length).toBe(2);
    for (const { parsed, thread } of threads) {
      expect(parsed.front).toMatchObject({ type: "question", areas: `[${STUDIO_AREA.id}]`, state: "active" });
      expect(parsed.front.opened).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const key of parsed.sections.keys()) expect(SECTIONS.has(key)).toBe(true);
      expect(thread.question).not.toBe("");
      for (const n of [...thread.notes, ...thread.responses]) expect(n.at).toMatch(ISO_TIME);
      for (const n of thread.notes) {
        expect(n.trigger).toBeTruthy();
        expect(n.model).toBeTruthy();
      }
    }
  });

  test("one thread waits on the user, the other is answered", () => {
    expect(threads.map((t) => threadWaits(t.thread))).toEqual([true, false]);
    const answered = threads[1]?.thread;
    expect(answered?.responses[0]?.re).toBe(answered?.notes[0]?.at);
  });
});

describe("seedStudio", () => {
  const git: Git = (args, cwd) => {
    const r = Bun.spawnSync(["git", "-C", cwd, ...args], { env: { PATH: process.env.PATH ?? "", HOME: cwd, GIT_CONFIG_NOSYSTEM: "1" }, stderr: "pipe" });
    return { exitCode: r.exitCode, stderr: r.stderr.toString() };
  };
  const log = (dir: string) => Bun.spawnSync(["git", "-C", dir, "log", "--format=%s"], { env: { PATH: process.env.PATH ?? "", HOME: dir } }).stdout.toString().trim();

  test("creates a repository with one commit, and leaves it alone on the next run", () => {
    const dir = mkdtempSync(join(tmpdir(), "threva-studio-"));
    try {
      expect(seedStudio(dir, Date.now(), git)).toEqual({ seeded: true });
      expect(log(dir)).toBe("Studio: sample threads for the dev stack");
      const path = join(dir, "threads", "budget-next-year.md");
      writeFileSync(path, "changed by hand\n");
      expect(seedStudio(dir, Date.now(), git)).toEqual({ seeded: false });
      expect(readFileSync(path, "utf8")).toBe("changed by hand\n");
      expect(log(dir)).toBe("Studio: sample threads for the dev stack");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
