import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { noticeEntries, renderNotices } from "./third-party-notices-lib";

const root = resolve(import.meta.dir, "..");
const file = resolve(root, "THIRD-PARTY-NOTICES.md");
writeFileSync(file, renderNotices(noticeEntries(root)));
console.log(`wrote ${file}`);
