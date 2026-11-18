import { join } from "node:path";
import type { SetupDeps } from "./setup";

export async function setupCalendar(prefix: string, deps: Pick<SetupDeps, "adapter" | "say" | "which">) {
  const bin = join(prefix, "var", "threva", "bin");
  const calendar = join(bin, "desk-calendar-mac");
  const reminders = join(bin, "desk-reminders-mac");
  async function available(command: string, args: string[], service: string): Promise<boolean> {
    if (!deps.which(command)) {
      deps.say(`The installed bundle has no ${service} adapter. Skipping ${service} setup.`);
      return false;
    }
    const result = await deps.adapter([command, ...args]);
    if (result.status === 0) return true;
    if (result.status === 3) {
      deps.say(`To use ${service}, allow access in System Settings > Privacy & Security > ${service}, then run threva setup --reconfigure.`);
      return false;
    }
    deps.say(`The ${service} adapter could not check access (exit ${result.status}). Setup kept ${service} configured.`);
    return true;
  }
  const canReadCalendar = await available(calendar, ["--days", "1"], "Calendars");
  const canWriteReminders = await available(reminders, ["--check-access"], "Reminders");
  const writers = {
    ...(canReadCalendar ? { calendar: [calendar, "--create"] } : {}),
    ...(canWriteReminders ? { reminder: [reminders] } : {}),
  };
  return {
    ...(canReadCalendar ? { sources: [{ id: "calendar", command: [calendar, "--days", "5"] }] } : {}),
    ...(Object.keys(writers).length ? { ask: { writers } } : {}),
  };
}
