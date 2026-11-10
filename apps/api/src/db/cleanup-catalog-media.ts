import { db } from "./client.js";
import { cleanupStaleCatalogMediaService } from "../services/catalog-media/cleanup-stale-catalog-media.js";
try { console.log(`Checked ${await cleanupStaleCatalogMediaService(db)} unreferenced catalog media assets older than 24 hours.`); }
finally { await db.destroy(); }
