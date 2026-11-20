export {};

const names = ["THREVA_SOURCE_DIR", "CORTEX_TAG", "THREVA_TAG"] as const;

const define = Object.fromEntries(names.map(name => [name, JSON.stringify(process.env[name] ?? "")]));

const result = await Bun.build({
  entrypoints: ["src/ui/index.html"],
  outdir: "dist/ui",
  target: "browser",
  splitting: true,
  define,
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
