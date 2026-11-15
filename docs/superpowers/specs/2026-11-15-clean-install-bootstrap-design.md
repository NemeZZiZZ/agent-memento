# Clean-install self-bootstrap — design (2026-11-15)

## Intent & why

A clean install of `opencode-memento` in OpenChamber (plugin string added to
`opencode.json`, or `opencode plugin add`) must become useful with **zero
terminal commands**.

Verified today: installation and loading are already automatic — the V2 server
background-installs the npm package into `~/.cache/opencode/npm/...` and loads
it (log evidence: plugin loaded from cache created Nov 7, no errors). What
breaks the experience is that the plugin is a **silent no-op** until the
project's memory index exists, and creating the first index requires the
terminal (`npm i -g @leonard-memento/core`, manual files; `memento init
opencode` only prints config — it never creates the tree).

## Goals

- On plugin load in a project with no memory tree: a starter `MEMORY.md`
  exists and is injected into context from the first session on.
- Idempotent; never overwrites existing files; never breaks the host
  (try/catch on every path, per repo convention).
- Same behavior on V2 (`setup`) and V1 (`server`/named export).

## Non-goals

- No memory capture, no tools, no GUI panel (approach C — later, if ever).
- The injected index block format stays frozen (byte-identical to v1.0.0).
- Not fixing the opencode CLI quirk (`plugin add` on an already-configured
  plugin skips install) — platform-side, out of scope.

## Approaches considered

- **A. Self-bootstrap (chosen).** Plugin creates the starter skeleton once.
  "Works immediately" holds; trades away a strict reading of the README's
  "no writes" (which was about capture — a one-time skeleton is setup).
- **B. Observability only.** Log status + README. Cheap, but the plugin still
  does nothing after install — fails the goal.
- **C. GUI status panel.** Best visibility; new export channel, new
  dependency (`@opencode/plugin`), much more work. Deferred.

## Design

1. **Core** — new export `bootstrapProjectIndex(projectDir, options)` in
   `@leonard-memento/core`, next to `readProjectIndex`: resolve root via the
   existing fallback chain; if the project subdir or `MEMORY.md` is missing,
   `mkdir -p` + write the starter file with flag `'wx'` (fail-if-exists, the
   overwrite guard); return `{ created, indexPath }`. New roots default to
   `~/.config/memento/projects`; the legacy root is honored only when it
   already exists (unchanged chain).
2. **Starter `MEMORY.md`** (English, ≤ ~15 lines): a header block addressed
   to the agent — the convention (`- [[name]] — description` one line per
   fact, sibling fact files with front-matter, keep it curated), and "delete
   this instruction block once real entries exist".
3. **Plugin** — V2 `setup(ctx)` and V1 `server()` call bootstrap before
   registering hooks, inside try/catch. On creation, one
   `console.log("opencode-memento: created starter memory index at <path>")`
   — lands in the server log (plugin API has no logger).
4. **CLI** — `memento init opencode` also calls bootstrap, so the CLI path
   creates the tree too.
5. **Docs** — README (root + package): clean install = add plugin string +
   restart; starter index appears on first load. Amend the "no writes" note:
   no capture, no LLM writes; the one-time starter skeleton is the only write.
6. **Tests** — core: bootstrap creates, is idempotent (second run writes
   nothing), respects an existing legacy root, honors `MEMENTO_MEMORY_ROOT`,
   `'wx'` never overwrites. opencode package: `setup()` on a tmp root creates
   the skeleton; the hook injects right after bootstrap.
7. **Versions** — core 0.2.1 → 0.3.0, opencode-memento 1.2.1 → 1.3.0 (dep
   `^0.3.0`). Commits per AGENTS.md prefixes (`feat:`, `test:`, `docs:`).

## Accepted consequence

Every project opened with the plugin gets a skeleton dir under the memory
root (hash16-keyed) on first load. That is the point of "works immediately",
not a leak.

## Left to the builder

Exact starter-file wording; test placement following existing
`packages/*/test` patterns.
