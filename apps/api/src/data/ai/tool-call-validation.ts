import { z } from "zod";

const maxJsonBytes = 64 * 1024;

const toolCallIdSchema = z
  .string()
  .min(1)
  .max(256)
  .refine((value) => value.trim().length > 0);

const toolNameSchema = z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,127}$/);
const inputSchema = z.record(z.string(), z.json());

const startToolCallSchema = z.object({
  turnId: z.string().uuid(),
  toolCallId: toolCallIdSchema,
  toolName: toolNameSchema,
  customerMessageId: z.string().uuid(),
  input: inputSchema,
});

const finishToolCallSchema = z
  .object({
    id: z.string().uuid(),
    status: z.enum(["succeeded", "failed"]),
    output: z.json().optional(),
    errorCode: z
      .string()
      .regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/)
      .optional(),
  })
  .superRefine(({ status, output, errorCode }, context) => {
    if (status === "failed" && output !== undefined && output !== null)
      context.addIssue({
        code: "custom",
        message: "Failed tool calls cannot persist output",
        path: ["output"],
      });
    if (status === "succeeded" && errorCode !== undefined)
      context.addIssue({
        code: "custom",
        message: "Succeeded tool calls cannot have an error code",
        path: ["errorCode"],
      });
  });

const linkToolCallsSchema = z.object({
  turnId: z.string().uuid(),
  customerMessageId: z.string().uuid(),
  assistantMessageId: z.string().uuid(),
});

const lastCatalogToolCallSchema = z.object({
  conversationId: z.string().uuid(),
  customerMessageId: z.string().uuid(),
  toolName: z.enum(["searchPublicCatalog", "getPublicCatalogItem"]),
});

export type StartToolCallInput = {
  turnId: string;
  toolCallId: string;
  toolName: string;
  customerMessageId: string;
  input: unknown;
};

export type FinishToolCallInput = {
  id: string;
  status: "succeeded" | "failed";
  output?: unknown;
  errorCode?: string;
};

export type LinkToolCallsInput = {
  turnId: string;
  customerMessageId: string;
  assistantMessageId: string;
};

export type LastCatalogToolCallInput = {
  conversationId: string;
  customerMessageId: string;
  toolName: "searchPublicCatalog" | "getPublicCatalogItem";
};

function parse<T>(schema: z.ZodType<T>, value: unknown, message: string): T {
  try {
    return schema.parse(value);
  } catch {
    throw new Error(message);
  }
}

function assertBoundedJson(value: unknown, message: string) {
  let encoded: string | undefined;
  try {
    encoded = JSON.stringify(value, null, 2);
  } catch {
    throw new Error(message);
  }
  if (
    encoded === undefined ||
    new TextEncoder().encode(encoded).byteLength > maxJsonBytes
  )
    throw new Error(message);
}

export function validateStartToolCall(value: unknown) {
  const parsed = parse(
    startToolCallSchema,
    value,
    "AI tool call input is invalid or too large",
  );
  assertBoundedJson(parsed.input, "AI tool call input is invalid or too large");
  return parsed;
}

export function validateFinishToolCall(value: unknown) {
  const parsed = parse(
    finishToolCallSchema,
    value,
    "AI tool call completion is invalid",
  );
  if (parsed.output !== undefined && parsed.output !== null)
    assertBoundedJson(
      parsed.output,
      "AI tool call output is invalid or too large",
    );
  return parsed;
}

export function validateLinkToolCalls(value: unknown) {
  return parse(
    linkToolCallsSchema,
    value,
    "AI tool call reply link is invalid",
  );
}

export function validateLastCatalogToolCall(value: unknown) {
  return parse(
    lastCatalogToolCallSchema,
    value,
    "AI catalog tool lookup is invalid",
  );
}
