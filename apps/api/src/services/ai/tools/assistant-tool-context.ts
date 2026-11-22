import type { HumanHandoffScope } from "../../../data/messages/request-human-handoff.js";
import type { ConversationMemoryScope } from "../../../data/messages/conversation-memory.js";
import type { MessageWithSender } from "../../../data/messages/types.js";
import type { Kysely } from "kysely";
import type { DB } from "../../../db/types.js";
import type { BookingDraftScope } from "../../../data/messages/booking-draft-guard.js";

export type AssistantToolContext = {
  db: Kysely<DB>;
  customerMessageId: string;
  turnId: string;
  assertActive: () => Promise<void>;
  onPersistenceFailure: () => void;
  canRecord?: () => boolean;
  canExecute?: () => boolean;
  customerScope?: { customerId: string; conversationId: string };
  resultCharacterBudget?: number;
  handoffScope?: HumanHandoffScope;
  memoryScope?: ConversationMemoryScope & { expectedMemory: string | null };
  draftScope?: BookingDraftScope;
  carryForwardBudget?: string;
  onDraftChanged?: (update: {
    selection: boolean;
    complete: boolean;
    waitForServiceChoice: boolean;
  }) => void;
  onHandoffCommitted?: (message: MessageWithSender) => void;
  isHandoffCommitted?: () => boolean;
};
