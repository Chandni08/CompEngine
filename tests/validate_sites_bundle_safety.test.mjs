import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Sites bundle excludes local environment files", () => {
  execFileSync(process.execPath, [path.join(root, "scripts", "build_sites_static.mjs")], { cwd: root });
  assert.equal(existsSync(path.join(root, "dist", "client", ".env.local")), false);
  assert.equal(existsSync(path.join(root, "dist", "client", ".vercel")), false);
});
