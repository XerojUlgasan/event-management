import { Client } from "pg";
import {
  edgeJobWorkers,
  workerTokenHeader,
  type EdgeJobWorker,
} from "../src/constants/edge-job-workers.js";
import { config } from "../src/env.js";

async function scheduleWorker(client: Client, worker: EdgeJobWorker, url: URL) {
  const jobTypes = worker.jobTypes.map((type) => `'${type}'`).join(", ");

  // The command is stored by pg_cron. Only the URL is instance-specific, and
  // Postgres quotes it before adding it to the command. The token stays in Vault.
  const command = `
    select net.http_post(
      url := %1$L,
      headers := jsonb_build_object(
        '${workerTokenHeader}',
        issued.at || '.' || encode(
          extensions.hmac(issued.at, secret.decrypted_secret, 'sha256'), 'hex'
        )
      ),
      timeout_milliseconds := 140000
    )
    from vault.decrypted_secrets as secret
    cross join (
      select floor(extract(epoch from statement_timestamp()))::bigint::text as at
    ) as issued
    where secret.name = '${worker.secret}'
      and not exists (
        select 1 from net.http_request_queue
        where method = 'POST' and url = %1$L
      )
      and exists (
        select 1 from public.background_jobs
        where type in (${jobTypes})
          and (
            (status = 'pending' and available_at <= now())
            or (status = 'running' and lease_expires_at <= now())
          )
      )
      and (
        select count(*) from (
          select 1 from public.background_jobs
          where type in (${jobTypes})
            and status = 'running' and lease_expires_at > now()
          limit 3
        ) as active_jobs
      ) < 3
  `;

  await client.query(
    `
        select vault.create_secret(
          replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
          $1
        )
        where not exists (select 1 from vault.secrets where name = $1)
      `,
    [worker.secret],
  );
  await client.query(
    `select cron.schedule($1, $2, format($3::text, $4::text))`,
    [worker.scheduleName, worker.interval, command, url.href],
  );
}

export async function scheduleEdgeWorkers(client: Client, functionUrl: URL) {
  await client.query("begin");

  try {
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [
      edgeJobWorkers.catalog.scheduleName,
    ]);
    await client.query("create extension if not exists pg_cron");
    await client.query(
      "create extension if not exists pg_net with schema extensions",
    );

    for (const worker of Object.values(edgeJobWorkers)) {
      await scheduleWorker(
        client,
        worker,
        new URL(functionUrl.href + worker.path),
      );
    }

    await client.query(
      "delete from vault.secrets where name = 'clemora_catalog_index_worker'",
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

  const functionUrl = new URL(`https://${ref}.supabase.co/functions/v1/api`);

  for (const worker of Object.values(edgeJobWorkers)) {
    const probe = await fetch(new URL(functionUrl.href + worker.path), {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });

    if (
      probe.status !== 401 ||
      (await probe.json()).error !== "Invalid worker token"
    )
      throw new Error(
        `Deploy the ${worker.scheduleName} route before enabling its schedule.`,
      );
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await scheduleEdgeWorkers(client, functionUrl);
    console.log(
      "Production catalog and image-message schedules are configured.",
    );
  } finally {
    await client.end();
  }
}

if (import.meta.main) {
  try {
    await main();
  } catch {
    console.error(
      "Could not configure background workers. Check the production database target, Edge deployment, and Cron, pg_net, and Vault permissions.",
    );
    process.exitCode = 1;
  }
}
