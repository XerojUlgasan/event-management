import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import type { HonoEnv } from "../../types/hono.js";
import { customerMessageBodySchema } from "./schemas.js";
import { checkMessageImages } from "../../services/messages/prepare-message-images.js";
import {
  MAX_MESSAGE_BODY_LENGTH,
  MAX_MESSAGE_IMAGES,
} from "@event-management/contracts/limits/messages";

export const multipartMessageSchema = z.object({
  body: z.string().trim().max(MAX_MESSAGE_BODY_LENGTH).optional(),
  conversationId: z.string().uuid().optional(),
  requestId: z.string().uuid().optional(),
  images: z
    .any()
    .openapi({
      type: "array",
      items: { type: "string", format: "binary" },
      maxItems: MAX_MESSAGE_IMAGES,
    })
    .optional(),
});

export function messageRequestBody<T extends z.ZodType>(schema: T) {
  // Hono gates validators by content type only for optional bodies. The handler
  // enforces a required, nonempty text-or-image payload after the selected parser.
  return {
    required: false as const,
    content: {
      "application/json": { schema },
      "multipart/form-data": { schema: multipartMessageSchema },
    },
  };
}

export async function parseMessageInput(
  c: Context<HonoEnv>,
  audience: "admin" | "customer" | "guest" = "admin",
) {
  const multipart = c.req
    .header("content-type")
    ?.toLowerCase()
    .startsWith("multipart/form-data");
  let raw: Record<string, unknown>;
  let files: File[] = [];

  if (multipart) {
    let form: FormData;

    try {
      form = await c.req.formData();
    } catch {
      throw new HTTPException(400, { message: "Invalid multipart message" });
    }

    for (const key of form.keys())
      if (!["body", "conversationId", "requestId", "images"].includes(key))
        throw new HTTPException(400, { message: "Invalid message field" });

    for (const key of ["body", "conversationId", "requestId"])
      if (form.getAll(key).length > 1)
        throw new HTTPException(400, { message: "Repeated message field" });

    const images = form.getAll("images");

    if (images.some((image) => typeof image === "string"))
      throw new HTTPException(400, { message: "Images must be files" });

    files = images as File[];
    raw = {
      body: form.get("body") ?? "",
      ...(form.has("conversationId")
        ? { conversationId: form.get("conversationId") }
        : {}),
      ...(form.has("requestId") ? { requestId: form.get("requestId") } : {}),
    };
  } else {
    try {
      raw = await c.req.json();
    } catch {
      throw new HTTPException(400, { message: "Invalid JSON message" });
    }
  }

  const customerJson = audience === "customer" && !multipart;

  if (
    !customerJson &&
    raw &&
    typeof raw === "object" &&
    "reviewMessageId" in raw
  )
    throw new HTTPException(400, {
      message: "Review replies require signed-in text chat",
    });

  const parsed = customerJson
    ? customerMessageBodySchema.safeParse(raw)
    : multipartMessageSchema.omit({ images: true }).safeParse(raw);

  if (!parsed.success)
    throw new HTTPException(400, { message: "Invalid message fields" });

  const input = parsed.data;
  const reviewMessageId =
    "reviewMessageId" in input && typeof input.reviewMessageId === "string"
      ? input.reviewMessageId.toLowerCase()
      : undefined;
  const body = input.body ?? "";

  if (!body && !files.length)
    throw new HTTPException(400, {
      message: "Write a message or attach an image before sending",
    });

  if (audience === "guest" && !input.requestId)
    throw new HTTPException(400, { message: "A request ID is required" });

  return {
    ...input,
    body,
    reviewMessageId,
    images: await checkMessageImages(files),
  };
}
