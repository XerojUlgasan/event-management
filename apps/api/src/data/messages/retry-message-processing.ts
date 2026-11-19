import { sql, type Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import {
  assertGuestActive,
  lockGuestConversation,
} from "../guest-chat/guest-conversation.js";
import { lockBackgroundJobsData } from "../background-jobs/queue.js";
import { selectMessageColumnsData } from "./select-message-columns.js";
import { jobDefinitions } from "../../services/background-jobs/job-definitions.js";

export class RetryMessageProcessingError extends Error {
  constructor(
    public readonly status: 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

export async function retryMessageProcessingData(
  db: Kysely<DB>,
  conversationId: string,
  messageId: string,
  viewer:
    | { role: "customer" | "admin"; userId: string }
    | { role: "guest"; token?: string },
) {
  return db.transaction().execute(async (trx) => {
    const conversation =
      viewer.role === "guest"
        ? await lockGuestConversation(trx, conversationId, viewer.token)
        : await trx
            .selectFrom("conversations")
            .selectAll()
            .where("id", "=", conversationId)
            .forUpdate()
            .executeTakeFirst();

    if (
      !conversation ||
      (viewer.role === "customer" && conversation.customer_id !== viewer.userId)
    )
      throw new RetryMessageProcessingError(404, "Conversation not found");

    if (conversation.status !== "active")
      throw new RetryMessageProcessingError(409, "Conversation is closed");

    if (conversation.guest_identity_id) {
      try {
        assertGuestActive(conversation);
      } catch {
        throw new RetryMessageProcessingError(409, "Conversation is closed");
      }
    }

    const message = await selectMessageColumnsData(trx, conversationId)
      .where("m.id", "=", messageId)
      .executeTakeFirst();

    if (
      !message ||
      !message.processing ||
      (viewer.role !== "admin" && message.sender_role !== "customer")
    )
      throw new RetryMessageProcessingError(
        404,
        "Message processing not found",
      );

    await lockBackgroundJobsData(trx);
    const job = await trx
      .selectFrom("background_jobs")
      .selectAll()
      .where("type", "=", "process_image_message")
      .where("dedupe_key", "=", messageId)
      .orderBy("created_at", "desc")
      .orderBy("id", "desc")
      .forUpdate()
      .executeTakeFirstOrThrow();

    if (["pending", "running"].includes(job.status)) return message;

    if (
      job.status !== "failed" ||
      ["invalid_image", "invalid_payload"].includes(job.last_error ?? "")
    )
      throw new RetryMessageProcessingError(
        409,
        "This message cannot be retried",
      );

    const parsed = jobDefinitions.process_image_message.payloadSchema.safeParse(
      job.payload,
    );

    if (
      !parsed.success ||
      parsed.data.messageId !== messageId ||
      parsed.data.conversationId !== conversationId
    )
      throw new RetryMessageProcessingError(
        409,
        "This message cannot be retried",
      );

    const reply = await trx
      .selectFrom("messages")
      .select("id")
      .where("reply_to_message_id", "=", messageId)
      .executeTakeFirst();

    if (reply)
      throw new RetryMessageProcessingError(
        409,
        "This message already has a reply",
      );

    const laterStarted = await sql<{ exists: boolean }>`select exists(
      select 1 from messages later join background_jobs j on j.dedupe_key = later.id::text
      join messages current on current.id = ${messageId}::uuid
      where later.conversation_id = ${conversationId}::uuid and j.type = 'process_image_message' and j.attempts > 0
        and (later.created_at, later.id) > (current.created_at, current.id)) as exists`.execute(
      trx,
    );
    await trx
      .updateTable("background_jobs")
      .set({
        status: "pending",
        attempts: 0,
        payload: JSON.stringify({
          ...parsed.data,
          ...(laterStarted.rows[0]?.exists ? { suppressReply: true } : {}),
        }),
        available_at: sql`clock_timestamp()`,
        completed_at: null,
        lease_token: null,
        lease_expires_at: null,
        last_error: null,
        updated_at: sql`clock_timestamp()`,
      })
      .where("id", "=", job.id)
      .execute();
    await trx
      .updateTable("guest_message_requests")
      .set({ completed: false, assistant_error: null })
      .where("message_id", "=", messageId)
      .execute();

    return selectMessageColumnsData(trx, conversationId)
      .where("m.id", "=", messageId)
      .executeTakeFirstOrThrow();
  });
}
