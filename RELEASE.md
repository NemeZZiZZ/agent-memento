# Release checklist (manual)

Publishing is deliberately manual. No changesets, no provenance automation.

## Per release

1. Bump versions in lockstep: all four packages carry the same version
   (currently 1.3.0); adapters depend on `agent-memento@^1.3.0`.
2. `npm test` — must be green on Node 20 and 22 (CI covers this). Push
   first and wait for the **whole** CI matrix (ubuntu + windows) to finish
   green (`gh run watch`) before tagging — v0.2.1 was tagged on a commit
   whose Windows job was still running and then failed.
3. Grep the public docs for version numbers: no README/docs statement may
   reference a version that is not on npm yet (`npm view <pkg> versions`),
   including the version this release is about to publish.
4. `npm pack --dry-run -w packages/core -w packages/opencode -w packages/claude-code -w packages/codex`
   — check each tarball contains only its whitelisted files.
5. Publish, engine first (the adapters depend on it):
   ```
   npm publish -w packages/core        # agent-memento
   npm publish -w packages/opencode    # opencode-memento
   npm publish -w packages/claude-code # claude-code-memento
   npm publish -w packages/codex       # codex-memento
   ```
6. Tag: `git tag vX.Y.Z && git push --tags` (family version = the shared
   version; all four packages release at the same number).

## One-time migration off the legacy names (before the first 1.3.0 release)

The engine was renamed from the scoped `@leonard-memento/core` to the
unscoped `agent-memento` (npm name verified free: registry 404, zero
download history). Adapter names never change. Old versions get removed,
not deprecated, because nobody depends on the family yet — and once the
engine is gone, old adapter versions would be uninstallable anyway
(their dependency would 404).

Migration is single-day. The ordering does all the work:

- **Engine before adapters** — `npm publish` resolves dependencies, so
  `agent-memento@1.3.0` must exist before adapters 1.3.0 are uploaded.
- **1.3.0 before the old adapter versions are removed** — a package name
  only enters npm's 24-hour block when its LAST version disappears.
  With 1.3.0 already published, unpublishing old adapter versions never
  empties the name, so no waiting day.
- **Old adapter versions before the engine** — npm refuses to unpublish
  a package that still has dependents, and the old adapter versions
  depend on `@leonard-memento/core`.

Steps:

1. Requires npm auth: `npm whoami` must succeed (`NPM_TOKEN` / `npm login`).
2. GitHub repo renamed `leonard-memento` → `agent-memento` (done 2026-11-15;
   the old rename redirect to this same repo is consumed by the rename).
   yangwenyu2/agent-memento (unrelated project) exists but GitHub names
   are unique per owner.
3. Publish the new family — engine first, then adapters (per release
   checklist steps 3–5):
   ```
   npm publish -w packages/core        # agent-memento@1.3.0
   npm publish -w packages/opencode    # opencode-memento@1.3.0
   npm publish -w packages/claude-code # claude-code-memento@1.3.0
   npm publish -w packages/codex       # codex-memento@1.3.0
   git tag v1.3.0 && git push origin v1.3.0
   ```
4. Unpublish the old ADAPTER versions (each: >72h since publish, <300
   downloads/week, single owner, no dependents — none apply):
   ```
   npm unpublish opencode-memento@1.2.1 --force
   npm unpublish opencode-memento@1.1.0 --force
   npm unpublish opencode-memento@1.0.0 --force
   npm unpublish claude-code-memento@0.2.1 --force
   npm unpublish claude-code-memento@0.1.0 --force
   npm unpublish codex-memento@0.2.1 --force
   npm unpublish codex-memento@0.1.0 --force
   ```
5. Unpublish the engine — its dependents are gone after step 4. Both
   versions are its only versions, so the `@leonard-memento/core` name
   enters the 24-hour block afterwards; irrelevant, the name is abandoned.
   ```
   npm unpublish @leonard-memento/core@0.2.1 --force
   npm unpublish @leonard-memento/core@0.1.0 --force
   ```
6. Archive `github.com/NemeZZiZZ/opencode-memento` (the v1.0.0
   predecessor repo, already archived) with a banner README pointing at
   this repo under its new name. Unpublished npm versions cannot be
   reinstalled — `npx @leonard-memento/core` stops working by design.
7. Optional smoke test: `/plugin install NemeZZiZZ/agent-memento` in a real
   Claude Code session, run `/compact`, confirm the index block reappears.
