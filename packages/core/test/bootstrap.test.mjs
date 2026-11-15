// Tests for bootstrapProjectIndex — the one-time starter skeleton.
//
// Every test passes an explicit mkdtemp memoryRoot: the default root
// chain (env → ~/.config/memento/projects → legacy) is never allowed
// to resolve in tests, so nothing ever touches the real home.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { projectHash, readProjectIndex, memoryIndexPath } from "../src/index.mjs";
import { STARTER_INDEX, bootstrapProjectIndex } from "../src/bootstrap.mjs";

const tmpRoot = () => mkdtempSync(join(tmpdir(), "memento-boot-root-"));

test("creates the starter index in an empty root", async () => {
  const memoryRoot = tmpRoot();
  const r = bootstrapProjectIndex("/proj", { memoryRoot });
  assert.deepEqual(r, { created: true, indexPath: memoryIndexPath("/proj", { memoryRoot }) });
  assert.equal(readFileSync(r.indexPath, "utf8"), STARTER_INDEX);
  const injected = await readProjectIndex("/proj", { memoryRoot });
  assert.equal(injected.includes("# Project memory index"), true);
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
