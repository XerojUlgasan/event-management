import { Cli } from "kysely-codegen";
import { databaseUrl } from "./config.js";

await new Cli().run({
  argv: process.argv.slice(2),
  config: {
    url: databaseUrl,
    outFile: "src/db/types.ts",
    excludePattern: "_prisma_migrations",
  },
});
