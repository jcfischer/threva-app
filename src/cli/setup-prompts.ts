import type { SetupDeps } from "./setup";

export async function askUntil(deps: Pick<SetupDeps, "ask" | "say">, question: string, valid: (answer: string) => boolean, hint: string, secret = false): Promise<string> {
  for (;;) {
    const answer = (await deps.ask(question, { secret })).trim();
    if (valid(answer)) return answer;
    deps.say(hint);
  }
}
