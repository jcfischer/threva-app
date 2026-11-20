import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

test("the real launcher replaces its PID and preserves Cortex arguments and exit status", async () => {
  const root = mkdtempSync(join(tmpdir(), "threva-launch-pid-"));
  try {
    const src = join(root, "src");
    mkdirSync(src);
    const config = join(root, "cortex.yaml");
    const log = join(root, "threva.log");
    writeFileSync(config, "apiKey: env:ANTHROPIC_API_KEY\n");
    writeFileSync(join(src, "cortex.ts"), [
      'if (process.argv[2] === "config") process.exit(0);',
      'console.log(JSON.stringify({pid:process.pid,args:process.argv.slice(2),hasKey:process.env.ANTHROPIC_API_KEY === "synthetic-key"}));',
      'process.exit(7);',
    ].join("\n"));
    const child = Bun.spawn([
      process.execPath, join(import.meta.dir, "../src/cli/threva.ts"),
      "launch", "--config", config, "--cortex", root, "--log", log,
    ], {
      env: { PATH: `${dirname(process.execPath)}:/usr/bin:/bin`, HOME: root, ANTHROPIC_API_KEY: "synthetic-key" },
      stdin: "ignore", stdout: "pipe", stderr: "pipe",
    });
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
    ]);
    expect(stderr).toBe("");
    expect(code).toBe(7);
    expect(JSON.parse(stdout)).toEqual({ pid: child.pid, args: ["start", "--config", config], hasKey: true });
    expect(readFileSync(log, "utf8")).not.toContain("synthetic-key");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
