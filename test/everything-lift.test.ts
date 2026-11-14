import { describe, expect, test } from "bun:test";
import type { OutlineCommand, OutlineRow } from "../src/ui/api/types";
import { liftSelection, liftTitle, withoutSelection } from "../src/ui/everything/lift";

describe("liftTitle", () => {
  test("takes the first line without leading marks", () => {
    expect(liftTitle("- [x] no\nsecond")).toBe("[x] no");
    expect(liftTitle("## Heading\nrest")).toBe("Heading");
    expect(liftTitle("> > quoted\nrest")).toBe("quoted");
    expect(liftTitle("1. first\n2. second")).toBe("first");
  });
  test("is empty for spaces or marks only", () => {
    expect(liftTitle("   \n ")).toBe("");
    expect(liftTitle("- \n>")).toBe("");
  });
  test("cuts to 300 characters", () => {
    expect(liftTitle("a".repeat(400))).toHaveLength(300);
  });
});

describe("withoutSelection", () => {
  test("removes a sentence", () => {
    const page = "One. Two.";
    expect(withoutSelection(page, 4, 9)).toBe("One.");
  });
  test("closes runs of empty lines left behind", () => {
    const page = "A\n\nB\n\nC";
    expect(withoutSelection(page, 3, 4)).toBe("A\n\nC");
  });
  test("keeps other blank runs", () => {
    const page = "A\n\n\n\nB\n\nC\n";
    expect(withoutSelection(page, 8, 9)).toBe("A\n\n\n\nB\n");
  });
  test("drops leading blank lines when the start is cut", () => {
    expect(withoutSelection("A\n\nB", 0, 1)).toBe("B");
  });
});

const parent = { id: "p", title: "P", weight: 1, note: "One. Two.", children: [] } as unknown as OutlineRow;
const view = (revision: number) => ({ date: "2026-01-01", revision, outline: parent });

function client(results: ({ ok: true } | { ok: false; message: string | null })[]) {
  const commands: OutlineCommand[] = [];
  return {
    commands,
    changeOutline: async (_date: string, command: OutlineCommand) => {
      commands.push(command);
      const next = results.shift()!;
      return next.ok ? { ok: true as const, data: { view: view(10 + commands.length) } } : { ok: false as const, message: next.message, status: 400 };
    },
  };
}

const request = (c: ReturnType<typeof client>) => ({ client: c, date: "2026-01-01", revision: 10, parent, page: "One. Two.", from: 5, to: 9, fallback: "fallback" });

describe("liftSelection", () => {
  test("adds the row, then saves the page without it", async () => {
    const c = client([{ ok: true }, { ok: true }]);
    const outcome = await liftSelection(request(c));
    expect(outcome.state).toBe("lifted");
    expect(c.commands[0]).toEqual({ op: "outline-add", revision: 10, parent: "p", title: "Two.", kind: "task" });
    expect(c.commands[1]).toMatchObject({ op: "outline-edit", revision: 11, id: "p", details: { note: "One." } });
  });
  test("leaves the page unchanged when Cortex refuses the row", async () => {
    const c = client([{ ok: false, message: "No." }]);
    expect(await liftSelection(request(c))).toEqual({ state: "refused", message: "No." });
    expect(c.commands).toHaveLength(1);
  });
  test("keeps the row when the page save is refused", async () => {
    const c = client([{ ok: true }, { ok: false, message: "Too long." }]);
    const outcome = await liftSelection(request(c));
    expect(outcome).toMatchObject({ state: "kept", page: "One.", message: "Too long." });
  });
  test("adds nothing for a selection of only marks", async () => {
    const c = client([]);
    expect(await liftSelection({ ...request(c), page: "-  ", from: 0, to: 3 })).toEqual({ state: "empty" });
    expect(c.commands).toHaveLength(0);
  });
});
