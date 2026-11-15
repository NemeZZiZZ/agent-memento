# Clean-Install Self-Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A clean install of opencode-memento works with zero terminal steps: on first plugin load in any project it creates a starter `MEMORY.md` so the index injection is live from the very first session.

**Architecture:** New sync `bootstrapProjectIndex()` in `@leonard-memento/core` (create-only via `'wx'`, never overwrites, resolves roots through the existing frozen chain). The opencode plugin calls it in both V2 `setup()` and the V1 factory before hook registration, wrapped in try/catch. `memento init opencode` calls it too via a per-target flag. Docs and versions updated to match.

**Tech Stack:** Plain ESM `.mjs` + JSDoc, Node ≥ 20 built-ins only, `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-15-clean-install-bootstrap-design.md`

## Global Constraints

- Plain ESM JavaScript (`.mjs`) + JSDoc. No TypeScript, no build step, zero runtime dependencies (opencode package depends only on `@leonard-memento/core`).
- Tests: `npm test` → `node --test`, files under `packages/*/test/*.test.mjs`, stock Node, no deps.
- Public docs in English.
- The injected index block format is FROZEN: byte-identical to opencode-memento v1.0.0 — `packages/core/src/read.mjs` stays untouched.
- `projectHash`/`canonicalDir` stay unchanged (existing memory trees must keep resolving).
- Host-facing plugin paths never throw: every bootstrap call in the plugin is wrapped in try/catch and degrades silently. Core itself throws loud on invalid config (`'~'`/empty memory root, non-plain `indexFile`) — same contract as `readProjectIndex`; adapters catch.
- New memory roots default to `~/.config/memento/projects`; the legacy root is honored only when it already exists (`resolveMemoryRoot` unchanged).
- Commit prefixes per AGENTS.md: `feat:` / `fix:` / `test:` / `docs:` / `chore:`.
- Versions: core 0.2.1 → 0.3.0; opencode-memento 1.2.1 → 1.3.0 with `"@leonard-memento/core": "^0.3.0"`.

## Review Focus

Failure classes the spec implies but no ordinary task exercises; each pinned by the named test in its owning task:

1. Two plugin loads racing on first open → exactly one creator (`'wx'`), the loser gets `created: false` and no log → Task 1 "idempotent…" (EEXIST is the race loser's view) + Task 2 "second setup…".
2. A user-created **empty** `MEMORY.md` must never gain content silently → stays empty, `readProjectIndex` still null → Task 1 "empty-but-existing…".
3. Index path exists as a directory (or root unwritable) → core throws loud, host never crashes → Task 1 "index path is a directory…" + Task 2 "setup never throws when bootstrap fails".
4. `'~'`-relative `memoryRoot` from a plugin config tuple → loud in core, host never crashes → Task 1 "invalid '~' root…" (existing Task 2 test "v1 server never throws on an invalid tuple option" keeps covering the host side).
5. A worktree session must share the main checkout's tree (canonical-path hash) — already pinned by existing tests: `paths.test.mjs` (`projectHash`/`canonicalDir`) and `adapter.test.mjs` ("prefers project.canonical over directory"). No new test; do not regress those.

---

### Task 1: `bootstrapProjectIndex` + `STARTER_INDEX` in core

**Files:**
- Create: `packages/core/src/bootstrap.mjs`
- Modify: `packages/core/src/index.mjs` (add one export line)
- Test: `packages/core/test/bootstrap.test.mjs`

**Interfaces:**
- Consumes: `memoryIndexPath(directory, { memoryRoot, indexFile })` from `./paths.mjs` (throws loud on invalid config; joins `<root>/<projectHash>/<indexFile>`).
- Produces (exported from `@leonard-memento/core`):
  - `STARTER_INDEX: string` — exact copy below.
  - `bootstrapProjectIndex(directory: string, options?: { memoryRoot?: string, indexFile?: string }): { created: boolean, indexPath: string }` — **sync**; `EEXIST` → `{ created: false, indexPath }`; any other write error (EISDIR, EACCES…) propagates loud.

- [ ] **Step 1: Write the failing tests** — `packages/core/test/bootstrap.test.mjs`. Use `mkdtempSync` roots and the option form `memoryRoot` (never the default chain, so tests never touch the real home):

```js
import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { projectHash, readProjectIndex, memoryIndexPath } from "../src/index.mjs";
import { STARTER_INDEX, bootstrapProjectIndex } from "../src/bootstrap.mjs";

const tmpRoot = () => mkdtempSync(join(tmpdir(), "memento-boot-root-"));

test("creates the starter index in an empty root", async () => {
  const memoryRoot = tmpRoot();
  const r = bootstrapProjectIndex("/proj", { memoryRoot });
  assert.deepEqual(r, { created: true, indexPath: memoryIndexPath("/proj", { memoryRoot }) });
  assert.equal((await readProjectIndex("/proj", { memoryRoot })).includes("# Project memory index"), true);
});

test("idempotent: existing index is never overwritten (also the lost-race path)", () => {
  const memoryRoot = tmpRoot();
  mkdirSync(join(memoryRoot, projectHash("/proj")), { recursive: true });
  const indexPath = memoryIndexPath("/proj", { memoryRoot });
  writeFileSync(indexPath, "- [[custom]] — mine\n");
  const r = bootstrapProjectIndex("/proj", { memoryRoot });
  assert.equal(r.created, false);
  assert.equal(r.indexPath, indexPath);
  assert.equal(readFileSync(indexPath, "utf8"), "- [[custom]] — mine\n");
});

test("empty-but-existing MEMORY.md stays empty and stays null on read", async () => {
  const memoryRoot = tmpRoot();
  mkdirSync(join(memoryRoot, projectHash("/proj")), { recursive: true });
  writeFileSync(memoryIndexPath("/proj", { memoryRoot }), "");
  assert.equal(bootstrapProjectIndex("/proj", { memoryRoot }).created, false);
  assert.equal(await readProjectIndex("/proj", { memoryRoot }), null);
});

test("honors indexFile option", () => {
  const memoryRoot = tmpRoot();
  const r = bootstrapProjectIndex("/proj", { memoryRoot, indexFile: "INDEX.md" });
  assert.equal(r.created, true);
  assert.ok(r.indexPath.endsWith("INDEX.md"));
  assert.equal(existsSync(join(memoryRoot, projectHash("/proj"), "INDEX.md")), true);
});

test("index path is a directory: throws loud (adapters catch)", () => {
  const memoryRoot = tmpRoot();
  const indexPath = memoryIndexPath("/proj", { memoryRoot });
  mkdirSync(indexPath, { recursive: true });
  assert.throws(() => bootstrapProjectIndex("/proj", { memoryRoot }));
});

test("invalid '~' root throws loud, mirroring readProjectIndex", () => {
  assert.throws(() => bootstrapProjectIndex("/proj", { memoryRoot: "~/mem" }), /'~'-relative/);
});
```

(Add missing imports the final file needs: `existsSync`, `readFileSync`. "creates the starter index…" also asserts the written file equals `STARTER_INDEX` exactly.)

- [ ] **Step 2: Run to verify failure** — `node --test packages/core/test/bootstrap.test.mjs`; expect module-not-found for `../src/bootstrap.mjs`.
- [ ] **Step 3: Implement `packages/core/src/bootstrap.mjs`.** Header comment: one-time starter skeleton for clean installs; create-only, never overwrite. Exact `STARTER_INDEX` copy (the spec fixes this wording; ends with a trailing newline):

```js
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
```

Body: `bootstrapProjectIndex` resolves `indexPath = memoryIndexPath(directory, options)` (its throw IS the loud-config contract), `mkdirSync(dirname(indexPath), { recursive: true })`, then `writeFileSync(indexPath, STARTER_INDEX, { flag: "wx" })` in try/catch mapping `EEXIST` → `{ created: false, indexPath }`, success → `{ created: true, indexPath }`, everything else rethrown. Add `export { STARTER_INDEX, bootstrapProjectIndex } from "./bootstrap.mjs";` to `packages/core/src/index.mjs`.
- [ ] **Step 4: Run to verify pass** — `node --test packages/core/test/bootstrap.test.mjs`; then full `npm test` (existing suites must stay green).
- [ ] **Step 5: Commit** — `git add packages/core/src/bootstrap.mjs packages/core/src/index.mjs packages/core/test/bootstrap.test.mjs && git commit -m "feat: bootstrapProjectIndex creates starter memory index on first load"`

### Task 2: opencode plugin bootstraps on load (V2 + both V1 paths)

**Files:**
- Modify: `packages/opencode/src/index.mjs`
- Test: `packages/opencode/test/adapter.test.mjs`

**Interfaces:**
- Consumes: `bootstrapProjectIndex(directory, options)` and `readProjectIndex` from `@leonard-memento/core` (Task 1).
- Produces: unchanged plugin surface (`default.setup(ctx)`, `default.server`, named `MementoPlugin`); side effect — starter index created before hooks register; one `console.log("opencode-memento: created starter memory index at <indexPath>")` per creation (plugin API has no logger; console lands in the server log).

- [ ] **Step 1: Update/add tests in `adapter.test.mjs`.** Three existing "silent without index" tests flip behavior (bootstrap now creates the starter, hook injects it) — rewrite them; the rest of the suite (pre-built `rootWithIndex` roots, invalid-root tests) must keep passing unchanged:
  - "hook is silent without index" → "setup bootstraps a starter index into an empty root": `fakeV2Context({ options: { memoryRoot } })` with `mkdtemp` root; after `plugin.setup(ctx)` assert `existsSync(join(memoryRoot, projectHash("/real"), "MEMORY.md"))` and that the context hook injects `await readProjectIndex("/real", { memoryRoot })` (canonical "/real" wins over "/fake").
  - "v1 server is silent without index" → same flip via `MEMENTO_MEMORY_ROOT` env root and `plugin.server({ directory: "/v1proj" })` (restore env in `finally`).
  - "v1 named export is silent without index" → same flip via `adapter.MementoPlugin({ directory: "/v1proj" }, { memoryRoot })`.
  - New "setup logs once when creating the starter": `t.mock.method(console, "log", () => {})`, run setup on empty root, assert one call whose argument includes `created starter memory index at` and the index path; `t.mock.restore()` in `finally`.
  - New "second setup does not rewrite an edited index": setup, overwrite the index file with custom content, setup again → content unchanged, no second log call.
  - New "setup never throws when bootstrap fails": make `<hash>/MEMORY.md` a directory inside the temp root → `await plugin.setup(ctx)` resolves, both hooks register, hook callback pushes nothing (`event.system` stays `[]`).
- [ ] **Step 2: Run to verify failures** — `node --test packages/opencode/test/adapter.test.mjs`; new/rewritten tests fail (no bootstrap yet).
- [ ] **Step 3: Implement in `packages/opencode/src/index.mjs`.** Import `bootstrapProjectIndex` beside `readProjectIndex`. Add one local helper used by both entry paths:

```js
function bootstrapQuietly(directory, options) {
  try {
    const r = bootstrapProjectIndex(directory, options);
    if (r.created) console.log(`opencode-memento: created starter memory index at ${r.indexPath}`);
  } catch {
    // A failing bootstrap must never break a session — worst case the
    // hook stays silent, exactly like a missing index before this feature.
  }
}
```

Call it in `setup(ctx)` right after `projectDir` is computed (before hook registration) and at the top of the `MementoPlugin` factory body with `input?.directory`. Update the file's header comment ("Zero dependencies… never called" block) with one line: the plugin now also creates a starter index when the project has none. Note in `MementoOptions` JSDoc that options feed bootstrap identically.
- [ ] **Step 4: Run to verify pass** — `node --test packages/opencode/test/adapter.test.mjs`, then `npm test`.
- [ ] **Step 5: Commit** — `git commit -m "feat: bootstrap starter memory index on plugin load (V2 + V1)"` (add both files).

### Task 3: `memento init opencode` bootstraps the tree

**Files:**
- Modify: `packages/core/src/init/targets.mjs` (opencode entry only)
- Modify: `packages/core/src/init/initAgent.mjs`
- Test: `packages/core/test/init.test.mjs`; fix two hazards in `packages/core/test/init-claude.test.mjs`

**Interfaces:**
- Consumes: `bootstrapProjectIndex(projectDir)` — no options: CLI uses the full default chain (env `MEMENTO_MEMORY_ROOT` → neutral → legacy), same as the plugin.
- Produces: `TARGETS.opencode.bootstrap: true` (flag pattern; aider/generic print targets unchanged); `initAgent` result shape unchanged; failure of bootstrap in the CLI surfaces as `MementoError(…, "BOOTSTRAP_FAILED")` (CLI errors should be actionable, not swallowed).

- [ ] **Step 1: Write failing tests in `init.test.mjs`** (reuse its `withMemoryRoot` helper, lines ~30–39):

```js
test("init opencode bootstraps the starter index", () => {
  withMemoryRoot((memoryRoot) => {
    const project = tempProject();
    const r = initAgent(project, "opencode");
    assert.equal(r.status, "printed");
    assert.equal(existsSync(memoryIndexPath(project, { memoryRoot })), true);
  });
});

test("init opencode is idempotent and never overwrites", () => {
  withMemoryRoot((memoryRoot) => {
    const project = tempProject();
    initAgent(project, "opencode");
    const indexPath = memoryIndexPath(project, { memoryRoot });
    writeFileSync(indexPath, "- [[kept]] — user content\n");
    initAgent(project, "opencode");
    assert.equal(readFileSync(indexPath, "utf8"), "- [[kept]] — user content\n");
  });
});
```

(Capture the project dir once — a second `tempProject()` call is a different hash. `init.test.mjs` may not define `tempProject` or import `memoryIndexPath`/`existsSync` yet: read the file first, reuse or add helpers/imports accordingly.) Also fix the two pollution hazards in `init-claude.test.mjs`: "print targets exit 0 and write nothing" (line ~128) and "opencode printout uses valid plugin config forms" (line ~148) currently run `init opencode` with no env root — after this task they would write into the real home. Pass `env: { MEMENTO_MEMORY_ROOT: <fresh temp root> }` to both `run(...)` calls; assertions otherwise unchanged (bootstrap writes to the memory root, not the project dir, so `readdirSync(projectDir)` stays `[]`).
- [ ] **Step 2: Run to verify failure** — `node --test packages/core/test`; new tests fail (`bootstrap` flag not honored yet).
- [ ] **Step 3: Implement.** In `targets.mjs`, add `bootstrap: true` to the `opencode` entry and extend its hint to: `"Starter memory index created if missing. Restart OpenCode — the plugin injects the index at every compaction."` (snippet text stays byte-identical — existing tests assert on it). In `initAgent`, after the `TARGETS[agent]` lookup: if `target.bootstrap`, call `bootstrapProjectIndex(projectDir)` inside try/catch that rethrows failures as `new MementoError(`could not create starter memory index: ${err.message}`, "BOOTSTRAP_FAILED")`. Update the `initAgent` header comment with one line about the one-time starter creation.
- [ ] **Step 4: Run to verify pass** — `node --test packages/core/test`, then full `npm test`. Confirm no writes outside temp roots: the previously-hazardous tests now pass with an env root.
- [ ] **Step 5: Commit** — `git commit -m "feat: memento init opencode creates the starter memory index"` (add the four files).

### Task 4: versions, lockfile, docs

**Files:**
- Modify: `packages/core/package.json` (version 0.3.0), `packages/opencode/package.json` (version 1.3.0, dep `"@leonard-memento/core": "^0.3.0"`), root `package-lock.json` (via npm)
- Modify: `README.md`, `packages/opencode/README.md`, `packages/core/README.md`

**Interfaces:** none (no code).

- [ ] **Step 1: Bump versions** in both `package.json` files as pinned above; refresh the lock with `npm install --package-lock-only` at the repo root; `git diff package-lock.json` should show only version/dep-range updates for the two workspace packages.
- [ ] **Step 2: Docs.** Read each file first, minimal edits:
  - `packages/opencode/README.md`: add a short "Clean install" paragraph — global install via `opencode plugin add opencode-memento` (or config + background install) is all it takes; the first plugin load in a project creates a starter index at `<memory root>/<hash>/MEMORY.md` and logs one line; existing indexes are never touched. Amend any "no writes"-style claim to: no capture, no LLM writes — the one-time starter skeleton is the only write.
  - Root `README.md`: wherever the OpenCode row/section describes `memento init opencode` as print-only, add that it also creates the starter memory index; mention the automatic bootstrap in the clean-install flow if one is described.
  - `packages/core/README.md`: add `bootstrapProjectIndex` + `STARTER_INDEX` to the API list with a one-line description (create-only, `'wx'`, EEXIST → `created: false`).
- [ ] **Step 3: Verify** — full `npm test` green; `grep -rn "no writes\|write" README.md packages/opencode/README.md` shows no stale absolute claims; smoke: `MEMENTO_MEMORY_ROOT=$(mktemp -d) node packages/core/bin/memento.mjs init opencode --project /tmp/smoke-proj` exits 0 and creates the index (then delete the temp dirs).
- [ ] **Step 4: Commit** — `git commit -m "chore: bump core 0.3.0 / opencode-memento 1.3.0; document self-bootstrap" -m "docs: honest clean-install flow; the starter skeleton is the only write"` (add the six files; or split `chore:`/`docs:` commits if cleaner).
