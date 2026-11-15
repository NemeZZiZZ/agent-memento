// opencode-memento — amnesia insurance for OpenCode.
//
// When a session is auto-compacted, the summarizer only sees what it is
// given. This plugin hands it your project's Markdown memory index, so
// long-term memory survives the summary instead of evaporating with the
// transcript.
//
// Zero dependencies by design. One file serves both plugin APIs:
//   - OpenCode 2.x: the default export, a plain { id, setup } object
//     (no Plugin.define import needed); the extra `server` key is tolerated
//     and never called;
//   - OpenCode 1.3.4 – 1.19.x: the loader sees `default` has `id`/`server`
//     and calls `default.server(input, options)` — `options` is the tuple
//     form `["npm:opencode-memento", { ... }]` from the config. Named
//     function exports are NOT reached on this path;
//   - OpenCode 1.0 – 1.3.3: the loader registered function exports only —
//     the named MementoPlugin export is kept as that fallback.
//   Local auto-discovery matches only `.opencode/plugin(s)/*.ts|*.js` (no .mjs).
//
// Every hook body is wrapped in try/catch: a failing memory lookup must
// never break a compaction or a session.
//
// On load, the plugin also creates the project's starter memory index
// (agent-facing instructions) when the project has none — clean installs
// become usable with zero terminal steps. Create-only, never overwrites.

import { readProjectIndex, bootstrapProjectIndex } from "@leonard-memento/core";

/**
 * @typedef {Object} MementoOptions
 * @property {string} [memoryRoot] - Directory holding one subdirectory per
 *   project, addressed by hash. Falls back to `MEMENTO_MEMORY_ROOT`, then
 *   the root chain: ~/.config/memento/projects → the legacy
 *   ~/.config/opencode/memento/projects (still honored).
 * @property {string} [indexFile] - Index file name inside a project's
 *   memory directory. Default: MEMORY.md (env fallback: MEMENTO_INDEX_FILE).
 *   These options feed both the bootstrap and the read path identically.
 */

/**
 * @param {unknown} value - raw ctx.options from the host
 * @returns {MementoOptions}
 */
function optionsFrom(value) {
  return value && typeof value === "object" ? value : {};
}

/**
 * Create the project's starter memory index when absent (clean installs).
 * Same options as the read path; one console line per creation — the
 * plugin API has no logger, and console output lands in the server log.
 */
function bootstrapQuietly(directory, options) {
  try {
    const r = bootstrapProjectIndex(directory, options);
    if (r.created) console.log(`opencode-memento: created starter memory index at ${r.indexPath}`);
  } catch {
    // A failing bootstrap must never break a session — worst case the
    // hook stays silent, exactly like a missing index before this feature.
  }
}

/**
 * V1 hook factory of shape `(input, options?) => Promise<Hooks>`. `input`
 * is V1's PluginInput `{ client, project, directory, $ }`; `options`
 * arrives from the tuple config form `["npm:opencode-memento", { ... }]`
 * and falls back to the MEMENTO_* env vars when absent.
 *
 * Reached two ways: as `default.server(input, options)` on OpenCode
 * >= 1.3.4 (the live path), and as the named export on the pre-1.3.4
 * loader, which registered function exports only.
 *
 * @param {{ directory?: string } | undefined} input - V1 PluginInput
 * @param {MementoOptions} [options] - tuple-form options from the config
 */
export const MementoPlugin = async (input, options) => {
  const resolved = optionsFrom(options);
  bootstrapQuietly(input?.directory, resolved);
  return {
    "experimental.session.compacting": async (_input, output) => {
      try {
        const text = await readProjectIndex(input?.directory, resolved);
        if (text) output.context.push(text);
      } catch {
        // A failing hook must never break a session.
      }
    },
  };
};

/** Dual OpenCode V1/V2 plugin definition. */
export default {
  id: "memento",
  async setup(ctx) {
    const options = optionsFrom(ctx.options);
    const projectDir = ctx.location.project?.canonical ?? ctx.location.directory;
    bootstrapQuietly(projectDir, options);
    // V2 idiom (verified live on OpenChamber 2.0.20 against working plugins):
    // register the SAME callback for "context" and "compaction", pushing
    // into event.system. The "context" hook fires on every provider request,
    // so the index is re-injected after each compaction by construction.
    const hook = async (event) => {
      try {
        const text = await readProjectIndex(projectDir, options);
        if (text) event.system.push({ type: "text", text });
      } catch {
        // A failing hook must never break a session.
      }
    };
    await ctx.session.hook("context", hook);
    await ctx.session.hook("compaction", hook);
  },
  /** V1 >= 1.3.4 entrypoint: the host passes the tuple options as the second argument. */
  server: (input, options) => MementoPlugin(input, options),
};
