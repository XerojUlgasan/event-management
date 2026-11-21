import type { HumanHandoffScope } from "../../../data/messages/request-human-handoff.js";
import type { ConversationMemoryScope } from "../../../data/messages/conversation-memory.js";
import type { MessageWithSender } from "../../../data/messages/types.js";
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
  proposalScope?: { customerId: string; conversationId: string };
  resultCharacterBudget?: number;
  handoffScope?: HumanHandoffScope;
  memoryScope?: ConversationMemoryScope & { expectedMemory: string | null };
  onHandoffCommitted?: (message: MessageWithSender) => void;
  isHandoffCommitted?: () => boolean;
};
