import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { Pool } from "pg";
import { hashSessionToken } from "../src/utils/session.js";

const database = `em_packages_test_${randomUUID().replaceAll("-", "")}`;
let app: typeof import("../src/app.js").app;
let db: typeof import("../src/db/client.js").db;
let admin: Pool;
let pool: Pool;
let adminCookie: string;
let staffCookie: string;
let undesignatedAdminCookie: string;
let customerCookie: string;
let storageServer: Server;
let failStorageDeletes = false;
const storedImages = new Map<string, { bytes: Buffer; contentType: string }>();

before(async () => {
  assert.ok(
    ["localhost", "127.0.0.1", "::1"].includes(
      process.env.DB_HOST ?? "localhost",
    ),
    "Tests require local PostgreSQL",
  );
  const connection = {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  admin = new Pool({ ...connection, database: process.env.DB_NAME });
  await admin.query(`CREATE DATABASE "${database}"`);
  pool = new Pool({ ...connection, database });
  const root = new URL("../prisma/migrations/", import.meta.url);
  for (const entry of (await readdir(root, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    await pool.query(
      await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"),
    );
  }
  storageServer = createServer(async (req, res) => {
    const path = req.url!.split("?")[0]!;
    if (req.method === "POST" || req.method === "PUT") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      storedImages.set(path, {
        bytes: Buffer.concat(chunks),
        contentType: String(req.headers["content-type"]),
      });
      res.end();
    } else if (req.method === "DELETE") {
      if (failStorageDeletes) {
        res.statusCode = 403;
        res.end();
      } else {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const payload = Buffer.concat(chunks).toString();
        if (payload) {
          const prefixes = (JSON.parse(payload) as { prefixes?: string[] }).prefixes ?? [];
          for (const prefix of prefixes) {
            const encoded = prefix.split("/").map((segment) => encodeURIComponent(segment)).join("/");
            storedImages.delete(`${path}/${encoded}`);
          }
        } else storedImages.delete(path);
        res.statusCode = 204;
        res.end();
      }
    } else {
      const image = storedImages.get(path);
      if (!image) {
        res.statusCode = 404;
        res.end();
      } else {
        res.setHeader("Content-Type", image.contentType);
        const range = req.headers.range?.match(/^bytes=(\d+)-(\d+)$/);
        if (range) {
          const start=Number(range[1]), end=Number(range[2]);
          res.statusCode=206;res.setHeader("Content-Range",`bytes ${start}-${end}/${image.bytes.length}`);
          res.setHeader("Content-Length",end-start+1);res.end(image.bytes.subarray(start,end+1));
        } else {res.setHeader("Content-Length",image.bytes.length);res.end(image.bytes);}
      }
    }
  });
  await new Promise<void>((resolve) =>
    storageServer.listen(0, "127.0.0.1", resolve),
  );
  const address = storageServer.address();
  assert.ok(address && typeof address !== "string");
  process.env.SUPABASE_URL = `http://127.0.0.1:${address.port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test";
  process.env.SUPABASE_STORAGE_BUCKET = "test";
  process.env.DB_NAME = database;
  ({ app } = await import("../src/app.js"));
  ({ db } = await import("../src/db/client.js"));
  async function session(role: string, staffRole: string | null = null) {
    const token = randomUUID();
    const user = await db
      .insertInto("users")
      .values({
        email: `${role}-${randomUUID()}@example.test`,
        password_hash: "unused",
        role,
        staff_role: staffRole,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    await db
      .insertInto("sessions")
      .values({
        user_id: user.id,
        token_hash: hashSessionToken(token),
        expires_at: new Date(Date.now() + 3600000),
      })
      .execute();
    return `em_session=${token}`;
  }
  adminCookie = await session("admin", "System Administrator");
  undesignatedAdminCookie = await session("admin");
  staffCookie = await session("staff", "Waiter");
  customerCookie = await session("customer");
});
after(async () => {
  if (storageServer)
    await new Promise<void>((resolve, reject) =>
      storageServer.close((err) => (err ? reject(err) : resolve())),
    );
  await db?.destroy();
  await pool?.end();
  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
  }
});
function call(
  path: string,
  method = "GET",
  body?: unknown,
  cookie?: string,
  origin?: string,
) {
  return app.request(`/v1${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(origin ? { Origin: origin } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const data = {
  name: "Celebration", description: "An elegant celebration with thoughtful details.", maxGuests: 100,
  price: {kind: "fixed", currency: "PHP", amountMinor: 12000000},
  sections: [{id: randomUUID(),title: "The experience",widgets: [
    {id: randomUUID(),type: "photo",x:0,y:0,w:6,h:6,markdown:"",media:{kind:"image",source:"sample",url:"/images/wedding.jpg"},alt:"Table setting",caption:""},
    {id: randomUUID(),type: "markdown",x:6,y:0,w:6,h:6,markdown:"## An occasion\n\nA **beautiful** celebration",media:null,alt:"",caption:""}
  ]}]
};
async function read(response: Response, status: number): Promise<any> {
  assert.equal(response.status, status, await response.clone().text());
  return response.status === 204 ? null : response.json();
}

async function createServiceWithPhoto(content: unknown) {
  const media = await read(await uploadCanvas(new Uint8Array([137,80,78,71,13,10,26,10,0]), "image/png"), 201);
  return read(await call("/admin/services", "POST", { ...(content as object), sections: [{ id: randomUUID(), title: "", widgets: [
    { id: randomUUID(), type: "photo", x: 0, y: 0, w: 12, h: 6, markdown: "", media, alt: "Service photo", caption: "" },
  ] }] }, adminCookie), 201);
}

test("services save directly, validate complete content, and enforce permissions", async () => {
  const content = { name: "Photo", description: "Coverage", hourlyRatePesos: 500 };
  await read(await call("/admin/services", "POST", content), 401);
  for (const cookie of [staffCookie, customerCookie, undesignatedAdminCookie]) await read(await call("/admin/services", "POST", content, cookie), 403);
  for (const hourlyRatePesos of [null, 0, -1, 1.5, 2147483648]) await read(await call("/admin/services", "POST", { ...content, hourlyRatePesos }, adminCookie), 400);
  await read(await call("/admin/services", "POST", content, adminCookie), 400);
  const created = await createServiceWithPhoto(content);
  assert.equal(created.name, content.name);
  assert.equal(created.hourlyRatePesos, 500);
  assert.equal("imageId" in created, false);
  assert.equal(created.imageUrl, created.sections[0].widgets[0].media.url);
  assert.ok(created.publishedAt);
  for (const key of ["draft", "published", "versions", "version", "state"]) assert.equal(key in created, false);
  assert.equal((await read(await call(`/services/${created.id}`), 200)).name, content.name);
  for (const field of [{ imageUrl: "https://example.test/image.jpg" }, { imageId: randomUUID() }]) {
    await read(await call("/admin/services", "POST", { ...content, ...field }, adminCookie), 400);
    await read(await call(`/admin/services/${created.id}`, "PATCH", { ...content, ...field, expectedUpdatedAt: created.updatedAt }, adminCookie), 400);
  }
  const edited = await read(await call(`/admin/services/${created.id}`, "PATCH", { ...content, name: "Changed", expectedUpdatedAt: created.updatedAt }, adminCookie), 200);
  assert.equal((await read(await call(`/services/${created.id}`), 200)).name, "Changed");
  await read(await call(`/admin/services/${created.id}`, "PATCH", { ...content, expectedUpdatedAt: created.updatedAt }, adminCookie), 409);
  await read(await call(`/admin/services/${created.id}`, "PATCH", { ...content, removeImage: true, expectedUpdatedAt: edited.updatedAt }, adminCookie), 400);
  await read(await call(`/admin/services/${created.id}/archive`, "POST", undefined, adminCookie), 200);
  await read(await call(`/services/${created.id}`), 404);
  await read(await call(`/admin/services/${created.id}`, "PATCH", { ...content, expectedUpdatedAt: edited.updatedAt }, adminCookie), 409);
  await read(await call(`/admin/services/${created.id}`, "DELETE", undefined, adminCookie), 204);
  await read(await call(`/admin/services/${created.id}`, "GET", undefined, adminCookie), 404);
  for (const route of ["draft", "publish"]) assert.equal((await call(`/admin/services/${created.id}/${route}`, route === "draft" ? "PATCH" : "POST", {}, adminCookie)).status, 404);
  const spec: any = await (await app.request("/openapi.json")).json();
  assert.ok(spec.paths["/v1/admin/services/{id}"].patch);
  assert.equal(spec.paths["/v1/admin/services/{id}/draft"], undefined);
  assert.equal(spec.paths["/v1/admin/services/{id}/publish"], undefined);
});

test("service canvas photos replace legacy image uploads and clean up removed media", async () => {
  const content = { name: "Uploaded service", description: "Description", hourlyRatePesos: 300 };
  const created = await createServiceWithPhoto(content);
  const oldPhoto = created.sections[0].widgets[0].media;
  const newPhoto = await read(await uploadCanvas(new Uint8Array([137,80,78,71,13,10,26,10,0]), "image/png"), 201);
  const sections = structuredClone(created.sections);
  sections[0].widgets[0].media = newPhoto;
  const edited = await read(await call(`/admin/services/${created.id}`, "PATCH", { ...content, sections, expectedUpdatedAt: created.updatedAt }, adminCookie), 200);
  assert.equal((await read(await call(`/services/${created.id}`), 200)).imageUrl, newPhoto.url);
  assert.equal((await app.request(oldPhoto.url)).status, 404);
  await read(await call(`/admin/services/${created.id}`, "PATCH", { ...content, sections, expectedUpdatedAt: created.updatedAt }, adminCookie), 409);
  await read(await call(`/admin/services/${created.id}`, "PATCH", { ...content, sections: [], expectedUpdatedAt: edited.updatedAt }, adminCookie), 400);
  assert.equal((await app.request(newPhoto.url)).status, 200);
  await read(await call(`/admin/services/${created.id}`, "DELETE", undefined, adminCookie), 204);
  assert.equal((await app.request(newPhoto.url)).status, 404);
  for (const [path, method] of [["/admin/service-uploads", "POST"], [`/admin/service-uploads/${created.id}`, "PATCH"], [`/service-images/${randomUUID()}`, "GET"]]) {
    assert.equal((await app.request(`/v1${path}`, { method, headers: { Cookie: adminCookie } })).status, 404);
  }
  const spec: any = await (await app.request("/openapi.json")).json();
  for (const path of ["/v1/admin/service-uploads", "/v1/admin/service-uploads/{id}", "/v1/service-images/{id}"]) assert.equal(spec.paths[path], undefined);
  const input = spec.paths["/v1/admin/services"].post.requestBody.content["application/json"].schema;
  const output = spec.paths["/v1/admin/services"].post.responses["201"].content["application/json"].schema;
  assert.equal("imageId" in input.properties, false);
  assert.equal("imageId" in output.properties, false);
});

test("canvas saves publish atomically, protect concurrent edits, and remove version/service contracts", async () => {
  await read(await call('/admin/packages'),401);
  for(const cookie of [customerCookie,staffCookie,undesignatedAdminCookie]) await read(await call('/admin/packages','POST',data,cookie),403);
  for(const patch of [{name:''},{price:null},{price:{...data.price,amountMinor:101}},{maxGuests:0},{services:[]},{eventTypes:['Birthday']},{guestMax:100}]) await read(await call('/admin/packages','POST',{...data,...patch},adminCookie),400);
  const created=await read(await call('/admin/packages','POST',data,adminCookie),201);
  assert.equal(created.name,data.name);assert.equal(created.description,data.description);assert.equal(created.imageUrl,'/images/wedding.jpg');
  for(const key of ['draft','published','versions','versionId','services','eventTypes','guestMax']) assert.equal(key in created,false);
  const detail=await read(await call(`/packages/${created.id}`),200);assert.equal(detail.sections[0].widgets.length,2);
  const edits=await Promise.all(['First edit','Second edit'].map(name=>call(`/admin/packages/${created.id}`,'PATCH',{...data,name,expectedUpdatedAt:created.updatedAt},adminCookie)));
  assert.deepEqual(edits.map(r=>r.status).sort(),[200,409]);
  const current=await read(await call(`/admin/packages/${created.id}`,'GET',undefined,adminCookie),200);
  const before=(await pool.query('SELECT count(*) FROM catalog_sections WHERE page_id=(SELECT id FROM catalog_pages WHERE package_id=$1)',[created.id])).rows[0].count;
  const bad=structuredClone(data);bad.sections[0].widgets[0].media={kind:'image',source:'upload',id:randomUUID(),url:'/v1/catalog-media/missing'} as any;
  await read(await call(`/admin/packages/${created.id}`,'PATCH',{...bad,name:'Must roll back',expectedUpdatedAt:current.updatedAt},adminCookie),400);
  assert.equal((await read(await call(`/packages/${created.id}`),200)).name,current.name);
  assert.equal((await pool.query('SELECT count(*) FROM catalog_sections WHERE page_id=(SELECT id FROM catalog_pages WHERE package_id=$1)',[created.id])).rows[0].count,before);
  assert.equal((await call(`/admin/packages/${created.id}/draft`,'PATCH',data,adminCookie)).status,404);
  assert.equal((await call(`/admin/packages/${created.id}/publish`,'POST',{},adminCookie)).status,404);
  assert.equal((await call(`/services/${randomUUID()}/packages`)).status,404);
  const archived=await read(await call(`/admin/packages/${created.id}/archive`,'POST',undefined,adminCookie),200);assert.ok(archived.archivedAt);
  await read(await call(`/packages/${created.id}`),404);
  await read(await call(`/admin/packages/${created.id}`,'DELETE',undefined,adminCookie),204);
  assert.equal((await pool.query('SELECT count(*) FROM catalog_pages WHERE package_id=$1',[created.id])).rows[0].count,'0');
});

test("package descriptions are stored independently from canvas text and enforce catalog limits", async () => {
  const created = await read(await call("/admin/packages", "POST", { ...data, description: "  A description for the card.  " }, adminCookie), 201);
  assert.equal(created.description, "A description for the card.");
  assert.equal((await pool.query("SELECT description FROM packages WHERE id=$1", [created.id])).rows[0].description, created.description);
  const { description: omitted, ...legacyContent } = data;
  const changedCanvas = structuredClone(legacyContent);
  changedCanvas.sections[0].widgets[1].markdown = "## Different canvas text";
  const edited = await read(await call(`/admin/packages/${created.id}`, "PATCH", { ...changedCanvas, expectedUpdatedAt: created.updatedAt }, adminCookie), 200);
  assert.equal(edited.description, created.description);
  assert.equal((await read(await call(`/packages/${created.id}`), 200)).description, created.description);
  assert.equal((await read(await call("/packages"), 200)).packages.find((item: any) => item.id === created.id).description, created.description);
  const limit = "x".repeat(4000);
  const boundary = await read(await call(`/admin/packages/${created.id}`, "PATCH", { ...data, description: limit, expectedUpdatedAt: edited.updatedAt }, adminCookie), 200);
  assert.equal(boundary.description, limit);
  await read(await call(`/admin/packages/${created.id}`, "PATCH", { ...data, description: limit + "x", expectedUpdatedAt: boundary.updatedAt }, adminCookie), 400);
  const cleared = await read(await call(`/admin/packages/${created.id}`, "PATCH", { ...data, description: "", expectedUpdatedAt: boundary.updatedAt }, adminCookie), 200);
  assert.equal(cleared.description, "");
  assert.equal((await read(await call(`/packages/${created.id}`), 200)).description, "");
  const textOnly = await read(await call("/admin/packages", "POST", { ...data, description: "Card text without canvas widgets", sections: [] }, adminCookie), 201);
  assert.equal(textOnly.description, "Card text without canvas widgets");
  await read(await call("/admin/packages", "POST", { ...data, description: limit + "x" }, adminCookie), 400);
  await read(await call("/admin/packages", "POST", { ...data, description: null }, adminCookie), 400);
});

test("catalog validates widget sources, bounds, counts and paginates direct packages",async()=>{
  for(const url of ['javascript:alert(1)','http://example.test/a.mp4','https://youtube.com/watch?v=bad','https://example.test/page','https://example.test/film.mp4','https://youtu.be/aqz-KE-bpKQ','https://vimeo.com/123456']) {
    const c=structuredClone(data);c.sections[0].widgets[0]={...c.sections[0].widgets[0],type:'video',media:{kind:'video',source:'external',url}};
    await read(await call('/admin/packages','POST',c,adminCookie),400);
  }
  const linkedPhoto=structuredClone(data);linkedPhoto.sections[0].widgets[0].media={kind:'image',source:'external',url:'https://example.test/photo.jpg'};
  await read(await call('/admin/packages','POST',linkedPhoto,adminCookie),400);
  await assert.rejects(pool.query("INSERT INTO media_assets(kind,source,url) VALUES('image','external','https://example.test/photo.jpg')"), /media_assets_source/);
  for(const geometry of [{x:11,w:2},{h:101},{w:0}]){const c=structuredClone(data);Object.assign(c.sections[0].widgets[0],geometry);await read(await call('/admin/packages','POST',c,adminCookie),400);}
  const c=structuredClone(data);c.sections[0].widgets.push({...c.sections[0].widgets[0]});await read(await call('/admin/packages','POST',c,adminCookie),400);
  const countBefore=(await read(await call('/packages'),200)).packages.length;
  for(let i=0;i<17;i++)await read(await call('/admin/packages','POST',{...data,name:`Paged ${i}`},adminCookie),201);
  const first=await read(await call('/packages?limit=15'),200);assert.equal(first.packages.length,15);assert.equal(first.nextOffset,15);
  const second=await read(await call('/packages?limit=15&offset=15'),200);assert.equal(second.packages.length,countBefore+2);assert.equal(second.nextOffset,null);
  const ids=[...first.packages,...second.packages].map(p=>p.id);assert.equal(new Set(ids).size,ids.length);
  await read(await call('/packages?limit=16'),400);
});

async function uploadCanvas(bytes:Uint8Array,mime:string,cookie=adminCookie){const form=new FormData();form.set('file',new Blob([Buffer.from(bytes)],{type:mime}),'media');return app.request('/v1/admin/catalog-media',{method:'POST',headers:{Cookie:cookie},body:form});}
test("video autoplay is opt-in, persists on public reads, and cannot be enabled for other widgets", async () => {
  const ordinary = await read(await call('/admin/packages', 'POST', data, adminCookie), 201);
  assert.ok(ordinary.sections[0].widgets.every((widget: { autoplay: boolean }) => widget.autoplay === false));
  for (const index of [0, 1]) {
    const invalid = structuredClone(data);
    Object.assign(invalid.sections[0].widgets[index], { autoplay: true });
    await read(await call('/admin/packages', 'POST', invalid, adminCookie), 400);
  }
  await assert.rejects(pool.query('UPDATE catalog_widgets SET autoplay=true WHERE id=$1', [ordinary.sections[0].widgets[0].id]), /catalog_widgets_video_autoplay/);
  const mp4 = new Uint8Array([0,0,0,20,102,116,121,112,105,115,111,109,0,0,0,0,105,115,111,109]);
  const media = await read(await uploadCanvas(mp4, 'video/mp4'), 201);
  const video = { id: randomUUID(), type: 'video', x: 0, y: 0, w: 12, h: 6, markdown: '', media, alt: '', caption: 'Event film', autoplay: true };
  const content = { ...data, sections: [{ id: randomUUID(), title: 'Film', widgets: [video] }] };
  const created = await read(await call('/admin/packages', 'POST', content, adminCookie), 201);
  const published = await read(await call(`/packages/${created.id}`), 200);
  assert.equal(published.sections[0].widgets[0].autoplay, true);
  assert.equal(published.sections[0].widgets[0].caption, 'Event film');
  assert.equal((await pool.query('SELECT autoplay FROM catalog_widgets WHERE id=$1', [published.sections[0].widgets[0].id])).rows[0].autoplay, true);
  const invalid = { ...content, sections: [{ ...content.sections[0], widgets: [{ ...video, autoplay: 'true' }] }] };
  await read(await call('/admin/packages', 'POST', invalid, adminCookie), 400);
  const edited = await read(await call(`/admin/packages/${created.id}`, 'PATCH', { ...content, sections: [{ ...content.sections[0], widgets: [{ ...video, autoplay: false }] }], expectedUpdatedAt: created.updatedAt }, adminCookie), 200);
  assert.equal(edited.sections[0].widgets[0].autoplay, false);
  assert.equal((await read(await call(`/packages/${created.id}`), 200)).sections[0].widgets[0].autoplay, false);
});
test("pending media stays private, published video streams ranges, and cleanup preserves saved assets",async()=>{
  const mp4=new Uint8Array([0,0,0,20,102,116,121,112,105,115,111,109,0,0,0,0,105,115,111,109]);
  await read(await uploadCanvas(mp4,'video/mp4',customerCookie),403);
  await read(await uploadCanvas(mp4,'image/png'),400);
  const media=await read(await uploadCanvas(mp4,'video/mp4'),201);
  await read(await app.request(media.url),404);
  const c={...data,sections:[{id:randomUUID(),title:'Film',widgets:[{id:randomUUID(),type:'video',x:0,y:0,w:12,h:6,markdown:'',media,alt:'',caption:'Event film'}]}]};
  const saved=await read(await call('/admin/packages','POST',c,adminCookie),201);
  const stream=await app.request(media.url);assert.equal(stream.status,200);assert.equal(stream.headers.get('accept-ranges'),'bytes');assert.deepEqual(new Uint8Array(await stream.arrayBuffer()),mp4);
  const part=await app.request(media.url,{headers:{Range:'bytes=4-7'}});assert.equal(part.status,206);assert.equal(part.headers.get('content-range'),`bytes 4-7/${mp4.length}`);assert.equal(Buffer.from(await part.arrayBuffer()).toString(),'ftyp');
  assert.equal((await app.request(media.url,{headers:{Range:'bytes=100-200'}})).status,416);
  await read(await call(`/admin/catalog-media/${media.id}`,'DELETE',undefined,adminCookie),409);
  await read(await call(`/admin/packages/${saved.id}`,'PATCH',{...data,expectedUpdatedAt:saved.updatedAt},adminCookie),200);
  await read(await app.request(media.url),404);assert.equal((await pool.query('SELECT count(*) FROM media_assets WHERE id=$1',[media.id])).rows[0].count,'0');
  const pending=await read(await uploadCanvas(mp4,'video/mp4'),201);
  await read(await call(`/admin/catalog-media/${pending.id}`,'DELETE',undefined,customerCookie),403);
  await read(await call(`/admin/catalog-media/${pending.id}`,'DELETE',undefined,adminCookie),204);
  const spec:any=await(await app.request('/openapi.json')).json();assert.ok(spec.paths['/v1/admin/packages/{id}'].patch);assert.equal(spec.paths['/v1/admin/packages/{id}/publish'],undefined);
});

test('stale pending uploads can be swept while referenced media survives',async()=>{
  const png=new Uint8Array([137,80,78,71,13,10,26,10,0]);
  const old=await read(await uploadCanvas(png,'image/png'),201);
  await pool.query("UPDATE media_assets SET created_at=now()-interval '2 days' WHERE id=$1",[old.id]);
  const {cleanupStaleCatalogMediaService}=await import('../src/services/catalog-media/catalog-media.js');
  await cleanupStaleCatalogMediaService(db);
  assert.equal((await pool.query('SELECT count(*) FROM media_assets WHERE id=$1',[old.id])).rows[0].count,'0');
  const media=await read(await uploadCanvas(png,'image/png'),201);
  const c=structuredClone(data);c.sections[0].widgets[0].media=media;
  await read(await call('/admin/packages','POST',c,adminCookie),201);
  await pool.query("UPDATE media_assets SET created_at=now()-interval '2 days' WHERE id=$1",[media.id]);
  await cleanupStaleCatalogMediaService(db);
  assert.equal((await app.request(media.url)).status,200);
});

test('admin archived media is private and unclaimed uploads cannot be taken by another admin',async()=>{
  const token=randomUUID();const user=await db.insertInto('users').values({email:`admin-${randomUUID()}@example.test`,password_hash:'unused',role:'admin',staff_role:'System Administrator'}).returning('id').executeTakeFirstOrThrow();await db.insertInto('sessions').values({user_id:user.id,token_hash:hashSessionToken(token),expires_at:new Date(Date.now()+3600000)}).execute();const other=`em_session=${token}`;
  const png=new Uint8Array([137,80,78,71,13,10,26,10,0]);const media=await read(await uploadCanvas(png,'image/png'),201);
  assert.equal((await app.request(media.url)).status,404);
  assert.equal((await app.request(media.url,{headers:{Cookie:adminCookie}})).status,200);
  const c=structuredClone(data);c.sections[0].widgets[0].media=media;
  await read(await call('/admin/packages','POST',c,other),400);
  const pkg=await read(await call('/admin/packages','POST',c,adminCookie),201);
  const edit=await read(await call(`/admin/packages/${pkg.id}`,'PATCH',{...c,name:'Other administrator edit',expectedUpdatedAt:pkg.updatedAt},other),200);
  await read(await call(`/admin/packages/${pkg.id}/archive`,'POST',undefined,other),200);
  assert.equal((await app.request(media.url)).status,404);
  assert.equal((await app.request(media.url,{headers:{Cookie:customerCookie}})).status,404);
  const archivedMedia=await app.request(media.url,{headers:{Cookie:other}});assert.equal(archivedMedia.status,200);assert.equal(archivedMedia.headers.get('cache-control'),'private, no-store');
  await read(await call(`/admin/packages/${edit.id}`,'DELETE',undefined,other),204);
});

test('canvas collection, Markdown and transport boundaries are enforced',async()=>{
  const {MAX_CATALOG_WIDGETS,MAX_CATALOG_SECTIONS,MAX_WIDGET_MARKDOWN_LENGTH}=await import('@event-management/contracts/catalog');
  const {CATALOG_JSON_BODY_LIMIT_BYTES}=await import('../src/constants/http.js');
  const {MAX_VIDEO_SIZE_BYTES}=await import('@event-management/contracts/limits/videos');
  const makeWidget=(i:number,length=1)=>({id:randomUUID(),type:'markdown',x:0,y:i,w:12,h:1,markdown:'a'.repeat(length),media:null,alt:'',caption:''});
  const maximum={...data,sections:[{id:randomUUID(),title:'',widgets:Array.from({length:MAX_CATALOG_WIDGETS},(_,i)=>makeWidget(i,MAX_WIDGET_MARKDOWN_LENGTH))}]};
  const saved=await read(await call('/admin/packages','POST',maximum,adminCookie),201);assert.equal(saved.sections[0].widgets.length,MAX_CATALOG_WIDGETS);
  await read(await call('/admin/packages','POST',{...maximum,sections:[{...maximum.sections[0],widgets:[...maximum.sections[0].widgets,makeWidget(101)]}]},adminCookie),400);
  await read(await call('/admin/packages','POST',{...data,sections:Array.from({length:MAX_CATALOG_SECTIONS+1},()=>({id:randomUUID(),title:'',widgets:[]}))},adminCookie),400);
  await read(await call('/admin/packages','POST',{...data,sections:[{id:randomUUID(),title:'',widgets:[makeWidget(0,MAX_WIDGET_MARKDOWN_LENGTH+1)]}]},adminCookie),400);
  const oversized=await app.request('/v1/admin/packages',{method:'POST',headers:{Cookie:adminCookie,'Content-Type':'application/json'},body:JSON.stringify({padding:'a'.repeat(CATALOG_JSON_BODY_LIMIT_BYTES)})});assert.equal(oversized.status,413);
  await read(await uploadCanvas(new Uint8Array(MAX_VIDEO_SIZE_BYTES+1),'video/mp4'),413);
});

test("service and venue canvases save rich content directly and enforce media ownership", async () => {
  const image = new Uint8Array([137,80,78,71,13,10,26,10,0]);
  const mp4 = new Uint8Array([0,0,0,20,102,116,121,112,105,115,111,109,0,0,0,0,105,115,111,109]);
  const photo = await read(await uploadCanvas(image, "image/png"), 201);
  const video = await read(await uploadCanvas(mp4, "video/mp4"), 201);
  const sections = [{ id: randomUUID(), title: "Gallery", widgets: [
    { id: randomUUID(), type: "photo", x: 0, y: 0, w: 6, h: 6, markdown: "", media: photo, alt: "Photo", caption: "", autoplay: false },
    { id: randomUUID(), type: "video", x: 6, y: 3, w: 5, h: 8, markdown: "", media: video, alt: "Film", caption: "Film caption", autoplay: true },
    { id: randomUUID(), type: "markdown", x: 2, y: 12, w: 8, h: 4, markdown: "## Details\n\n**Custom content**", media: null, alt: "", caption: "", autoplay: false },
  ] }];
  const service = { name: "Canvas service", description: "Summary", hourlyRatePesos: 100, sections };
  const created = await read(await call("/admin/services", "POST", service, adminCookie), 201);
  const visible = await read(await call(`/services/${created.id}`), 200);
  assert.equal(visible.imageUrl, photo.url);
  assert.deepEqual(visible.sections[0].widgets.map((w: any) => [w.type, w.x, w.y, w.w, w.h]), [["photo",0,0,6,6],["video",6,3,5,8],["markdown",2,12,8,4]]);
  assert.equal(visible.sections[0].widgets[1].autoplay, true);
  assert.equal(visible.sections[0].widgets[2].markdown, "## Details\n\n**Custom content**");
  assert.equal((await call(`/catalog-media/${photo.id}`)).status, 200);
  const venue = { name: "Canvas venue", location: "City", description: "Summary", maxGuests: 100, sections };
  await read(await call("/admin/venues", "POST", venue, adminCookie), 400);
  const { sections: ignored, ...legacy } = service;
  const edited = await read(await call(`/admin/services/${created.id}`, "PATCH", { ...legacy, name: "Changed", expectedUpdatedAt: created.updatedAt }, adminCookie), 200);
  assert.equal(edited.sections[0].widgets[0].media.id, photo.id);
  assert.equal((await read(await call(`/services/${created.id}`), 200)).name, "Changed");
  await read(await call(`/admin/services/${created.id}/archive`, "POST", undefined, adminCookie), 200);
  assert.equal((await call(`/catalog-media/${photo.id}`)).status, 404);
  assert.equal((await call(`/catalog-media/${photo.id}`, "GET", undefined, adminCookie)).status, 200);
  await read(await call(`/admin/services/${created.id}`, "DELETE", undefined, adminCookie), 204);
  assert.equal((await pool.query("SELECT id FROM media_assets WHERE id=$1", [photo.id])).rowCount, 0);
  assert.equal((await pool.query("SELECT id FROM media_assets WHERE id=$1", [video.id])).rowCount, 0);
  const venuePhoto = await read(await uploadCanvas(image, "image/png"), 201);
  const venueVideo = await read(await uploadCanvas(mp4, "video/mp4"), 201);
  const venueSections = structuredClone(sections);
  venueSections[0].widgets[0].media = venuePhoto;
  venueSections[0].widgets[1].media = venueVideo;
  const savedVenue = await read(await call("/admin/venues", "POST", { ...venue, sections: venueSections }, adminCookie), 201);
  const publicVenue = await read(await call(`/venues/${savedVenue.id}`), 200);
  assert.equal(publicVenue.sections[0].widgets[0].media.id, venuePhoto.id);
  assert.equal(publicVenue.sections[0].widgets[1].autoplay, true);
  assert.equal(publicVenue.sections[0].widgets[2].markdown, "## Details\n\n**Custom content**");
  const { sections: ignoredVenueSections, ...legacyVenue } = venue;
  const venueLegacyEdit = await read(await call(`/admin/venues/${savedVenue.id}`, "PATCH", { ...legacyVenue, expectedUpdatedAt: savedVenue.updatedAt }, adminCookie), 200);
  assert.equal(venueLegacyEdit.sections[0].widgets[1].media.id, venueVideo.id);
  const venueEdit = await read(await call(`/admin/venues/${savedVenue.id}`, "PATCH", { ...venue, sections: [], expectedUpdatedAt: venueLegacyEdit.updatedAt }, adminCookie), 200);
  assert.deepEqual(venueEdit.sections, []);
  assert.equal((await call(`/catalog-media/${venuePhoto.id}`)).status, 404);
  for (const media of [venuePhoto, venueVideo]) assert.equal((await pool.query("SELECT id FROM media_assets WHERE id=$1", [media.id])).rowCount, 0);
});
