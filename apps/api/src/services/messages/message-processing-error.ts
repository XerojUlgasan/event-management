export class MessageProcessingError extends Error {
  constructor(
    public readonly code:
      | "invalid_payload"
      | "invalid_image"
      | "image_unavailable"
      | "vision_unavailable"
      | "reply_unavailable",
  ) {
    super(code);
  }
}
