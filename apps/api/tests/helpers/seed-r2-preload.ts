import { localR2Fetch } from "./r2-fixture.js";

const origin = process.env.SEED_TEST_R2_ORIGIN;
if (!origin) throw new Error("Seed test requires its local R2 fixture");

globalThis.fetch = localR2Fetch(origin);
