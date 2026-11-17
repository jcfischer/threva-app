import { errorMessage } from "./text";

export async function runCapture(command: string[], env?: Record<string, string | undefined>): Promise<{ status: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn(command, { env, stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, status] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { status, stdout, stderr };
}

export const COMMAND_NOT_RUN = 127;

export async function runOrReport(command: string[], env?: Record<string, string | undefined>): Promise<{ status: number; stdout: string; stderr: string }> {
  try {
    return await runCapture(command, env);
  } catch (err) {
    return { status: COMMAND_NOT_RUN, stdout: "", stderr: `${command[0] ?? ""} could not run: ${errorMessage(err)}` };
  }
}
