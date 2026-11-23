import {
  messageImageInterpretationSchema,
  type MessageImage,
} from "@event-management/contracts/message-images";
import {
  catalogBrowseSchema,
  catalogRecommendationsSchema,
  chatMessageSchema,
  type ChatMessage,
} from "@event-management/contracts/messages";
import type { MessageWithSender } from "../data/messages/types.js";

export function messageDto(row: MessageWithSender): ChatMessage {
  const role: ChatMessage["senderRole"] =
    row.sender_role === "assistant"
      ? "assistant"
      : row.sender_role === "admin"
        ? "admin"
        : "customer";
  const browse = catalogBrowseSchema.safeParse(row.catalog_browse);
  const recommendations = catalogRecommendationsSchema.safeParse(
    row.catalog_recommendations,
  );
  const suggestedReplies = chatMessageSchema.shape.suggestedReplies.safeParse(
    row.suggested_replies,
  );

  return {
    id: row.id,
    processing: row.processing ?? null,
    images: (row.images ?? []).map((value) => {
      const image = value as {
        id: string;
        mime_type: MessageImage["mimeType"];
        byte_size: number;
        interpretation: unknown;
      };

      return {
        id: image.id,
        url: `/v1/message-images/${image.id}`,
        mimeType: image.mime_type,
        byteSize: image.byte_size,
        interpretation:
          image.interpretation == null
            ? null
            : messageImageInterpretationSchema.parse(image.interpretation),
      };
    }),
    body: row.body,
    quotationId: row.quotation_id,
    ...(role === "assistant" && browse.success
      ? { catalogBrowse: browse.data }
      : {}),
    ...(role === "assistant" && recommendations.success
      ? { catalogRecommendations: recommendations.data }
      : {}),
    ...(role === "assistant" && suggestedReplies.success
      ? { suggestedReplies: suggestedReplies.data }
      : {}),
    ...(role === "assistant" && row.handoff_acknowledgement
      ? { handoffAcknowledgement: true as const }
      : {}),
    replyToMessageId: row.reply_to_message_id,
    senderId: row.sender_id,
    senderRole: role,
    senderName:
      role === "assistant"
        ? "AMAC AI"
        : (row.sender_display_name ??
          row.sender_email ??
          (role === "customer" ? "Guest" : "Clemora team")),
    createdAt: row.created_at.toISOString(),
    readAt: row.read_at?.toISOString() ?? null,
  };
}
