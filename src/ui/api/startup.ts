export type Startup =
  | { state: "checking" }
  | { state: "ready" }
  | { state: "failed"; message: string | null }
  | { state: "refused"; built: string; found: string };
