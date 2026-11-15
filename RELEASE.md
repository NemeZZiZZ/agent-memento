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
not deprecated, because nobody depends on the family yet:

1. Requires npm auth: `npm whoami` must succeed (`NPM_TOKEN` / `npm login`).
2. Rename the GitHub repo `leonard-memento` → `agent-memento` first; the
   name is free for this owner (an old rename redirect to this same repo
   is consumed by the rename). yangwenyu2/agent-memento (unrelated
   project) exists but GitHub names are unique per owner.
3. Unpublish dependent versions before the versions they depend on —
   npm refuses to unpublish a package that has dependents:
   ```
   npm unpublish opencode-memento@1.2.1 --force
   npm unpublish opencode-memento@1.1.0 --force
   npm unpublish opencode-memento@1.0.0 --force
   npm unpublish claude-code-memento@0.2.1 --force
   npm unpublish claude-code-memento@0.1.0 --force
   npm unpublish codex-memento@0.2.1 --force
   npm unpublish codex-memento@0.1.0 --force
   npm unpublish @leonard-memento/core@0.2.1 --force
   npm unpublish @leonard-memento/core@0.1.0 --force
   ```
   Preconditions per version (npm policy, >72h after publish): no
   dependents (step 3 order guarantees it), <300 downloads/week (the
   family never crossed ~250/month), single owner.
4. Unpublishing ALL versions of a name blocks that name on npm for 24
   hours. The adapters keep their names and their version numbers were
   never at 1.3.0, so publish the new family the NEXT day:
   agent-memento@1.3.0, opencode-memento@1.3.0, claude-code-memento@1.3.0,
   codex-memento@1.3.0 — per the Per release checklist above.
5. Archive `github.com/NemeZZiZZ/opencode-memento` (the v1.0.0
   predecessor repo, already archived) with a banner README pointing at
   this repo under its new name. Unpublished npm versions cannot be
   reinstalled — `npx @leonard-memento/core` stops working by design.
6. Optional smoke test: `/plugin install NemeZZiZZ/agent-memento` in a real
   Claude Code session, run `/compact`, confirm the index block reappears.
