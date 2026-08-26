import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const handler = require("../api/conferences.js");

async function invoke(method, body, headers = {}) {
  let statusCode = 200;
  let payload;
  const response = {
    setHeader() {},
    status(value) { statusCode = value; return this; },
    json(value) { payload = value; return value; },
  };
  await handler({ method, body, headers }, response);
  return { statusCode, payload };
}

test("conference updates survive an API reload through the configured server JSON file", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "conference-catalog-test-"));
  const catalogPath = path.join(directory, "catalog.json");
  const previousEnvironment = {
    path: process.env.CONFERENCE_CATALOG_PATH,
    user: process.env.CONFERENCE_ADMIN_USER_ID,
    passwordHash: process.env.CONFERENCE_ADMIN_PASSWORD_HASH,
    secret: process.env.CONFERENCE_ADMIN_SESSION_SECRET,
  };

  process.env.CONFERENCE_CATALOG_PATH = catalogPath;
  process.env.CONFERENCE_ADMIN_USER_ID = "test-admin";
  process.env.CONFERENCE_ADMIN_PASSWORD_HASH = createHash("sha256").update("test-password").digest("hex");
  process.env.CONFERENCE_ADMIN_SESSION_SECRET = "test-only-session-secret";

  try {
    const seed = await invoke("GET");
    assert.equal(seed.statusCode, 200);
    assert.equal(seed.payload.persisted, false);

    const session = await invoke("POST", { userId: "test-admin", password: "test-password" });
    assert.equal(session.statusCode, 200);

    const records = seed.payload.records.map((record, index) => index === 0
      ? { ...record, title: `${record.title} — persisted update` }
      : record);
    const saved = await invoke("PUT", { records }, { authorization: `Bearer ${session.payload.token}` });
    assert.equal(saved.statusCode, 200);
    assert.equal(saved.payload.persisted, true);

    const onDisk = JSON.parse(await readFile(catalogPath, "utf8"));
    assert.equal(onDisk.records[0].title, records[0].title);

    const reloaded = await invoke("GET");
    assert.equal(reloaded.statusCode, 200);
    assert.equal(reloaded.payload.persisted, true);
    assert.equal(reloaded.payload.records[0].title, records[0].title);
  } finally {
    for (const [key, value] of Object.entries({
      CONFERENCE_CATALOG_PATH: previousEnvironment.path,
      CONFERENCE_ADMIN_USER_ID: previousEnvironment.user,
      CONFERENCE_ADMIN_PASSWORD_HASH: previousEnvironment.passwordHash,
      CONFERENCE_ADMIN_SESSION_SECRET: previousEnvironment.secret,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(directory, { recursive: true, force: true });
  }
});
