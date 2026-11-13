const steps: string[][] = [["bunx", "tsc", "--noEmit"], ["bun", "test", "test"]];
for (const cmd of steps) {
  const run = Bun.spawnSync(cmd, { stdout: "inherit", stderr: "inherit" });
  if (run.exitCode !== 0) process.exit(run.exitCode ?? 1);
}
