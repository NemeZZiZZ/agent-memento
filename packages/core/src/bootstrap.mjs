// @leonard-memento/core — one-time starter skeleton for clean installs.
//
// A project with no memory tree yet gets a starter MEMORY.md the first
// time the plugin (or `memento init`) loads in it, so the index
// injection is live from the very first session — no terminal steps.
// Create-only: 'wx' refuses to touch anything that already exists, so
// bootstrap can never clobber user content, and a race between two
// hosts resolving the same new project has exactly one winner.

import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { memoryIndexPath } from "./paths.mjs";

/**
 * The starter index content: agent-facing instructions for maintaining
 * the memory convention, meant to be replaced by real entries.
 */
export const STARTER_INDEX = `# Project memory index

This file rides every session and every compaction — it is how this
project keeps long-term memory. Maintain it as you work:

- One line per durable fact: \`- [[fact-name]] — short description.\`
- Details go in a sibling file \`fact-name.md\` with front-matter
  (\`name\`, \`description\`, \`type\`, \`created\`, \`updated\`).
- Record only what must survive the session: decisions, gotchas,
  conventions. Delete lines that stop being true.
- Replace this instruction block with real entries when they appear.
`;

/**
 * Create the project's starter memory index if (and only if) absent.
 *
 * Invalid config ('~'-relative or empty memory root, non-plain index
 * file name) throws loud via `memoryIndexPath` — same contract as
 * `readProjectIndex`; adapters catch. EEXIST (index already there,
 * including empty files and lost races) is success: never overwrite.
 *
 * @param {string} directory - absolute project directory.
 * @param {{ memoryRoot?: string, indexFile?: string }} [options]
 * @returns {{ created: boolean, indexPath: string }}
 */
export function bootstrapProjectIndex(directory, { memoryRoot, indexFile } = {}) {
  const indexPath = memoryIndexPath(directory, { memoryRoot, indexFile });
  mkdirSync(dirname(indexPath), { recursive: true });
  try {
    writeFileSync(indexPath, STARTER_INDEX, { flag: "wx" });
  } catch (err) {
    if (err?.code === "EEXIST") {
      // O_EXCL reports existence before type, so a directory squatting on
      // the index path arrives here too. A regular file is genuine
      // "already bootstrapped" (or a lost race); anything else is a broken
      // target that must not masquerade as success — loud, adapters catch.
      if (statSync(indexPath).isFile()) return { created: false, indexPath };
    }
    throw err; // EISDIR, EACCES… — loud; host adapters catch.
  }
  return { created: true, indexPath };
}
