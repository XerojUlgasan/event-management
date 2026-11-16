import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { Pool } from "pg";

const migration = "20261116072801_embed_catalog_canvas";

test("canvas migration preserves ordered package and service content and media references", async () => {
  const host = process.env.DB_HOST ?? "localhost";
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(host));
  const connection = {
    host,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  const database = `em_json_canvas_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ ...connection, database: process.env.DB_NAME });
  let pool: Pool | undefined;
  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    pool = new Pool({ ...connection, database });
    const root = new URL("../prisma/migrations/", import.meta.url);
    const entries = (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && entry.name < migration)
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries)
      await pool.query(
        await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"),
      );

    const pkg = (
      await pool.query(
        "INSERT INTO packages(name,slug,max_guests,price) VALUES('Canvas','canvas',100,1000) RETURNING id",
      )
    ).rows[0].id;
    const empty = (
      await pool.query(
        "INSERT INTO packages(name,slug,max_guests,price) VALUES('Empty','empty',100,1000) RETURNING id",
      )
    ).rows[0].id;
    const service = (
      await pool.query(
        "INSERT INTO services(name,slug,description) VALUES('Service','service','Description') RETURNING id",
      )
    ).rows[0].id;
    const photo = (
      await pool.query(
        "INSERT INTO media_assets(kind,source,url) VALUES('image','sample','/images/wedding.jpg') RETURNING id",
      )
    ).rows[0].id;
    const video = (
      await pool.query(
        "INSERT INTO media_assets(kind,source,storage_key,mime_type,byte_size) VALUES('video','upload','migration-video','video/mp4',100) RETURNING id",
      )
    ).rows[0].id;
    const packagePage = (
      await pool.query(
        "INSERT INTO catalog_pages(package_id) VALUES($1) RETURNING id",
        [pkg],
      )
    ).rows[0].id;
    const servicePage = (
      await pool.query(
        "INSERT INTO catalog_pages(service_id) VALUES($1) RETURNING id",
        [service],
      )
    ).rows[0].id;
    const later = (
      await pool.query(
        "INSERT INTO catalog_sections(page_id,title,sort_order) VALUES($1,'Later',5) RETURNING id",
        [packagePage],
      )
    ).rows[0].id;
    const first = (
      await pool.query(
        "INSERT INTO catalog_sections(page_id,title,sort_order) VALUES($1,'First',1) RETURNING id",
        [packagePage],
      )
    ).rows[0].id;
    const serviceSection = (
      await pool.query(
        "INSERT INTO catalog_sections(page_id,title,sort_order) VALUES($1,'Service',0) RETURNING id",
        [servicePage],
      )
    ).rows[0].id;
    const textId = randomUUID(),
      photoId = randomUUID(),
      videoId = randomUUID();
    await pool.query(
      `INSERT INTO catalog_widgets(id,section_id,type,sort_order,x,y,w,h,markdown,media_id,alt,caption,autoplay) VALUES
      ($1,$4,'photo',8,7,3,5,4,'',$6,'Photo alt','Photo caption',false),
      ($2,$4,'markdown',2,0,1,6,7,'**Details**',NULL,'','',false),
      ($3,$5,'video',0,2,4,8,9,'',$7,'Video alt','Video caption',true)`,
      [photoId, textId, videoId, first, serviceSection, photo, video],
    );
    const ownerSnapshots = new Map<string, unknown>();
    for (const table of ["packages", "services"])
      ownerSnapshots.set(
        table,
        (
          await pool.query(
            `SELECT to_jsonb(t) AS record FROM ${table} t ORDER BY id`,
          )
        ).rows,
      );
    await pool.query(
      await readFile(new URL(`${migration}/migration.sql`, root), "utf8"),
    );
    for (const table of ["packages", "services"])
      assert.deepEqual(
        (
          await pool.query(
            `SELECT to_jsonb(t)-'canvas' AS record FROM ${table} t ORDER BY id`,
          )
        ).rows,
        ownerSnapshots.get(table),
        "owner fields and exact timestamps must survive",
      );

    const expectedPackage = [
      {
        id: first,
        title: "First",
        widgets: [
          {
            id: textId,
            type: "markdown",
            x: 0,
            y: 1,
            w: 6,
            h: 7,
            markdown: "**Details**",
            mediaId: null,
            alt: "",
            caption: "",
            autoplay: false,
          },
          {
            id: photoId,
            type: "photo",
            x: 7,
            y: 3,
            w: 5,
            h: 4,
            markdown: "",
            mediaId: photo,
            alt: "Photo alt",
            caption: "Photo caption",
            autoplay: false,
          },
        ],
      },
      { id: later, title: "Later", widgets: [] },
    ];
    const expectedService = [
      {
        id: serviceSection,
        title: "Service",
        widgets: [
          {
            id: videoId,
            type: "video",
            x: 2,
            y: 4,
            w: 8,
            h: 9,
            markdown: "",
            mediaId: video,
            alt: "Video alt",
            caption: "Video caption",
            autoplay: true,
          },
        ],
      },
    ];
    assert.deepEqual(
      (await pool.query("SELECT canvas FROM packages WHERE id=$1", [pkg]))
        .rows[0].canvas,
      expectedPackage,
    );
    assert.deepEqual(
      (await pool.query("SELECT canvas FROM services WHERE id=$1", [service]))
        .rows[0].canvas,
      expectedService,
    );
    assert.deepEqual(
      (await pool.query("SELECT canvas FROM packages WHERE id=$1", [empty]))
        .rows[0].canvas,
      [],
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int AS count FROM media_assets WHERE id = ANY($1::uuid[])",
          [[photo, video]],
        )
      ).rows[0].count,
      2,
    );
    for (const table of [
      "catalog_widgets",
      "catalog_sections",
      "catalog_pages",
    ])
      assert.equal(
        (await pool.query("SELECT to_regclass($1) AS name", [table])).rows[0]
          .name,
        null,
      );
    for (const table of ["packages", "services"]) {
      await assert.rejects(
        pool.query(`UPDATE ${table} SET canvas='{}'::jsonb WHERE id=$1`, [
          table === "packages" ? pkg : service,
        ]),
      );
      await assert.rejects(
        pool.query(`UPDATE ${table} SET canvas=NULL WHERE id=$1`, [
          table === "packages" ? pkg : service,
        ]),
      );
      await assert.rejects(
        pool.query(`UPDATE ${table} SET canvas=$2::jsonb WHERE id=$1`, [
          table === "packages" ? pkg : service,
          JSON.stringify([{ id: randomUUID(), title: "Bad", widgets: [{}] }]),
        ]),
      );
    }
  } finally {
    await pool?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
  }
});
