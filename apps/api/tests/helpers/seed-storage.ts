import { once } from "node:events";
import { createServer } from "node:http";
import { localR2Fetch, r2Fixture } from "./r2-fixture.js";

export async function startSeedStorage() {
  const bucket = "seed-test";
  const objects = new Map<string, { bytes: Buffer; mimeType: string }>();
  let writes = 0;

  const server = createServer(async (req, res) => {
    const prefix = `/${bucket}/`;

    if (!req.url?.startsWith(prefix)) {
      res.writeHead(404).end();

      return;
    }

    const key = decodeURIComponent(req.url.slice(prefix.length));

    if (req.method === "PUT") {
      const chunks: Buffer[] = [];

      for await (const chunk of req) chunks.push(chunk);

      writes++;

      if (objects.has(key) && req.headers["if-none-match"] === "*") {
        res.writeHead(412).end();

        return;
      }

      objects.set(key, {
        bytes: Buffer.concat(chunks),
        mimeType: req.headers["content-type"] ?? "application/octet-stream",
      });
      res.writeHead(200).end();

      return;
    }

    const object = objects.get(key);

    if (req.method === "GET" && object) {
      res.writeHead(200, { "Content-Type": object.mimeType }).end(object.bytes);

      return;
    }

    res.writeHead(404).end();
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  if (!address || typeof address === "string")
    throw new Error("Storage test server requires a TCP port");

  const origin = `http://127.0.0.1:${address.port}`;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = localR2Fetch(origin);

  return {
    origin,
    objects,
    get writes() {
      return writes;
    },
    env: { ...r2Fixture, R2_BUCKET_NAME: bucket },
    close: () => {
      globalThis.fetch = originalFetch;
      return new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
