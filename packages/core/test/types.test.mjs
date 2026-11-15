import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import * as core from "../src/index.mjs";

const dts = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src", "index.d.ts"), "utf8");

// The package ships a hand-written index.d.ts for TypeScript consumers
// while the runtime is plain ESM. Nothing forces the two to agree, so
// this test pins it: every runtime value export is declared, and the
// signatures the README advertises exist verbatim.

const runtimeValueExports = [
  "canonicalDir",
  "projectHash",
  "resolveMemoryRoot",
  "memoryIndexPath",
  "readProjectIndex",
  "bootstrapProjectIndex",
  "STARTER_INDEX",
  "claudeProjectSlug",
  "claudeMemoryDir",
  "parseFactFile",
  "syncClaude",
  "TARGETS",
  "initAgent",
  "MementoError",
];

test("every runtime value export is declared in index.d.ts", () => {
  for (const name of runtimeValueExports) {
    assert.match(dts, new RegExp(`export (function|const|class) ${name}\\b`), `${name} missing from index.d.ts`);
  }
});

test("declared value exports exist at runtime (no phantom API)", () => {
  for (const name of runtimeValueExports) {
    assert.ok(core[name] !== undefined, `${name} declared in index.d.ts but not exported at runtime`);
  }
});

test("bootstrapProjectIndex signature matches the shipped API", () => {
  assert.match(
    dts,
    /export function bootstrapProjectIndex\(directory: string, options\?: MemoryOptions\): BootstrapResult;/,
  );
  assert.match(dts, /export interface BootstrapResult \{[\s\S]*?created: boolean;[\s\S]*?indexPath: string;/);
  assert.match(dts, /export const STARTER_INDEX: string;/);
});

test("InitTarget declares the bootstrap flag", () => {
  assert.match(dts, /export interface InitTarget \{[\s\S]*?bootstrap\?: boolean;/);
});

test("MementoErrorCode includes BOOTSTRAP_FAILED", () => {
  assert.match(dts, /\| "BOOTSTRAP_FAILED"/);
});
