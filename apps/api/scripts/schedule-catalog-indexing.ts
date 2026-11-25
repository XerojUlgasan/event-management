import { Client } from "pg";
import {
  catalogIndexJobTypes,
  catalogIndexWorkerPath,
  catalogIndexWorkerSecret,
  catalogIndexWorkerTokenHeader,
} from "../src/constants/catalog-index-worker.js";
import { config } from "../src/env.js";

const scheduleName = "clemora-catalog-indexing";

const catalogTypes = catalogIndexJobTypes.map((type) => `'${type}'`).join(", ");

export async function scheduleCatalogIndexing(client: Client, url: URL) {
  // The command is stored by pg_cron. Only the URL is instance-specific, and
  // Postgres quotes it before adding it to the command. The token stays in Vault.
  const command = `
    select net.http_post(
      url := %L,
      headers := jsonb_build_object(
        '${catalogIndexWorkerTokenHeader}', secret.decrypted_secret
      ),
      timeout_milliseconds := 140000
    )
    from vault.decrypted_secrets as secret
    where secret.name = '${catalogIndexWorkerSecret}'
      and exists (
        select 1 from public.background_jobs
        where type in (${catalogTypes})
          and (
            (status = 'pending' and available_at <= now())
            or (status = 'running' and lease_expires_at <= now())
          )
      )
      and (
        select count(*) from (
          select 1 from public.background_jobs
          where type in (${catalogTypes})
            and status = 'running' and lease_expires_at > now()
          limit 3
        ) as active_jobs
      ) < 3
  `;

  await client.query("begin");

  try {
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [
      scheduleName,
    ]);
    await client.query("create extension if not exists pg_cron");
    await client.query(
      "create extension if not exists pg_net with schema extensions",
    );
    await client.query(
      `
        select vault.create_secret(
          replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
          $1
        )
        where not exists (select 1 from vault.secrets where name = $1)
      `,
      [catalogIndexWorkerSecret],
    );
    await client.query(
      `select cron.schedule($1, '10 seconds', format($2::text, $3::text))`,
      [scheduleName, command, url.href],
    );
    await client.query("commit");
  } catch (cause) {
    await client.query("rollback");
    throw cause;
  }
}

async function main() {
  const connectionString = config.PROD_SUPABASE_DB_URL ?? "";
  const db = URL.parse(connectionString);
  const ref = db?.hostname.endsWith(".pooler.supabase.com")
    ? /^postgres\.([a-z0-9]{20})$/.exec(db.username)?.[1]
    : /^db\.([a-z0-9]{20})\.supabase\.co$/.exec(db?.hostname ?? "")?.[1];
  const configuredRef = config.PROD_SUPABASE_REF;

  if (
    !db ||
    !["postgres:", "postgresql:"].includes(db.protocol) ||
    (db.port && db.port !== "5432") ||
    !ref ||
    (configuredRef && ref !== configuredRef)
  ) {
    throw new Error(
      "Use the production Supabase direct or session pooler URI on port 5432.",
    );
  }

  const url = new URL(
    `https://${ref}.supabase.co/functions/v1/api${catalogIndexWorkerPath}`,
  );
  const probe = await fetch(url, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });

  if (
    probe.status !== 401 ||
    (await probe.json()).error !== "Invalid worker token"
  )
    throw new Error(
      "Deploy the catalog indexing route before enabling its schedule.",
    );

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await scheduleCatalogIndexing(client, url);
    console.log("Production catalog indexing schedule is configured.");
  } finally {
    await client.end();
  }
}

if (import.meta.main) {
  try {
    await main();
  } catch {
    console.error(
      "Could not configure catalog indexing. Check the production database target, Edge deployment, and Cron, pg_net, and Vault permissions.",
    );
    process.exitCode = 1;
  }
}
