import { expect, test } from "bun:test";
import { setupCalendar } from "../src/cli/setup-calendar";

const calendar = "/opt/homebrew/var/threva/bin/desk-calendar-mac";
const reminders = "/opt/homebrew/var/threva/bin/desk-reminders-mac";

async function configure(calendarStatus: number, reminderStatus = 0) {
  const calls: string[][] = [];
  const messages: string[] = [];
  const config = await setupCalendar("/opt/homebrew", {
    which: path => path,
    say: line => messages.push(line),
    adapter: async args => {
      calls.push(args);
      return { status: args[0] === calendar ? calendarStatus : reminderStatus, stdout: "", stderr: "" };
    },
  });
  return { config, calls, messages };
}

test("setup requests each grant and wires the granted sources and writers", async () => {
  const { calls, config } = await configure(0);
  expect(calls).toEqual([[calendar, "--days", "1"], [reminders, "--check-access"]]);
  expect(config.sources).toEqual([{ id: "calendar", command: [calendar, "--days", "5"] }]);
  expect(config.ask?.writers).toEqual({ calendar: [calendar, "--create"], reminder: [reminders] });
});

test("declining calendar access leaves the calendar empty and continues setup", async () => {
  const { messages, config } = await configure(3);
  expect(messages.join(" ")).toContain("Privacy & Security > Calendars");
  expect(config.sources).toBeUndefined();
  expect(config.ask?.writers).toEqual({ reminder: [reminders] });
});

test("declining Reminders access keeps the granted calendar source and writer", async () => {
  const { messages, config } = await configure(0, 3);
  expect(messages.join(" ")).toContain("Privacy & Security > Reminders");
  expect(config.sources).toEqual([{ id: "calendar", command: [calendar, "--days", "5"] }]);
  expect(config.ask?.writers).toEqual({ calendar: [calendar, "--create"] });
});
