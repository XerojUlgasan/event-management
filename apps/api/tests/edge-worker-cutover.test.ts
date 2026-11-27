import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  edgeJobWorkers,
  legacyWorkerTokenHeader,
  workerTokenHeader,
  workerVersionHeader,
} from "../src/constants/edge-job-workers.js";
import { verifyWorkerToken } from "../src/edge/worker-auth.js";
import { verifyWorkerReadiness } from "../scripts/schedule-edge-workers.js";

const now = 1_700_000_000_000;

const token = (key: string, seconds = now / 1000) =>
  `${seconds}.${createHmac("sha256", key).update(String(seconds)).digest("hex")}`;

test("each worker accepts only its matching header and Vault key during cutover", async () => {
  for (const worker of Object.values(edgeJobWorkers)) {
    const secrets = new Map<string, string>([
      [worker.secret, "new-key"],
      [worker.legacySecret, "old-key"],
    ]);

    const lookup = async (name: string) => secrets.get(name);

    const verify = (values: Record<string, string>) =>
      verifyWorkerToken(new Headers(values), worker, lookup, now);

    assert.equal(await verify({ [workerTokenHeader]: token("new-key") }), true);
    assert.equal(
      await verify({ [legacyWorkerTokenHeader]: token("old-key") }),
      true,
    );
    assert.equal(
      await verify({ [workerTokenHeader]: token("old-key") }),
      false,
    );
    assert.equal(
      await verify({ [legacyWorkerTokenHeader]: token("new-key") }),
      false,
    );
    assert.equal(
      await verify({
        [workerTokenHeader]: token("new-key"),
        [legacyWorkerTokenHeader]: token("old-key"),
      }),
      false,
    );
    assert.equal(
      await verify({
        [legacyWorkerTokenHeader]: token("old-key", now / 1000 - 31),
      }),
      false,
    );
    secrets.delete(worker.legacySecret);
    assert.equal(
      await verify({ [legacyWorkerTokenHeader]: token("old-key") }),
      false,
    );
  }
});

test("scheduler refuses old or incomplete deployments before changing schedules", async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async () =>
      Response.json({ error: "Invalid worker token" }, { status: 401 });
    await assert.rejects(
      verifyWorkerReadiness(new URL("https://example.test/api")),
    );
    let probes = 0;
    globalThis.fetch = async () => {
      probes++;

      return Response.json(
        { error: "Invalid worker token" },
        { status: 401, headers: { [workerVersionHeader]: "1" } },
      );
    };
    await verifyWorkerReadiness(new URL("https://example.test/api"));
    assert.equal(probes, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
