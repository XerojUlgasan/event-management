import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export type Database = Kysely<DB> | Transaction<DB>;

export type CatalogKnowledgeOwner = {
  kind: "package" | "service";
  id: string;
};
