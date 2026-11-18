import type { Kysely } from "kysely";
import type { DB } from "../../../db/types.js";

export type AssistantToolContext = {
  db: Kysely<DB>;
  customerMessageId: string;
  turnId: string;
  assertActive: () => Promise<void>;
  onPersistenceFailure: () => void;
  canRecord?: () => boolean;
  canExecute?: () => boolean;
};
