import { z } from "zod";

export const agentPersonalities = [
  "professional",
  "friendly",
  "warm_concise",
] as const;

export const agentSettingsLimits = {
  displayName: 60,
  greeting: 240,
  additionalInstructions: 2_000,
  previewMessage: 1_000,
  previewMessages: 11,
} as const;

const noNullCharacters = (value: string) => !value.includes("\0");

export const agentProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1)
    .max(agentSettingsLimits.displayName)
    .refine(noNullCharacters),
  greeting: z
    .string()
    .trim()
    .max(agentSettingsLimits.greeting)
    .refine(noNullCharacters)
    .nullable(),
});

export const agentSettingsSchema = agentProfileSchema
  .extend({
    personality: z.enum(agentPersonalities),
    additionalInstructions: z
      .string()
      .trim()
      .max(agentSettingsLimits.additionalInstructions)
      .refine(noNullCharacters),
    allowBusinessInformation: z.boolean(),
    allowPublicCatalog: z.boolean(),
  })
  .strict();

export type AgentProfile = z.infer<typeof agentProfileSchema>;

export type AgentSettings = z.infer<typeof agentSettingsSchema>;

export const defaultAgentSettings: AgentSettings = {
  displayName: "AMAC AI",
  greeting: null,
  personality: "warm_concise",
  additionalInstructions: "",
  allowBusinessInformation: true,
  allowPublicCatalog: true,
};

export const agentSettingsResponseSchema = z.object({
  settings: agentSettingsSchema,
  revision: z.number().int().positive(),
  updatedAt: z.iso.datetime(),
});

export const saveAgentSettingsSchema = z
  .object({
    settings: agentSettingsSchema,
    expectedRevision: z.number().int().positive(),
  })
  .strict();

const agentPreviewMessageSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z
      .string()
      .trim()
      .min(1)
      .max(agentSettingsLimits.previewMessage)
      .refine(noNullCharacters),
  })
  .strict();

export const agentPreviewSchema = z
  .object({
    settings: agentSettingsSchema,
    messages: z
      .array(agentPreviewMessageSchema)
      .min(1)
      .max(agentSettingsLimits.previewMessages)
      .refine(
        (messages) =>
          messages.length % 2 === 1 &&
          messages.every(
            (message, index) =>
              message.role === (index % 2 === 0 ? "user" : "assistant"),
          ),
        "Test messages must alternate and end with a customer message",
      ),
  })
  .strict();

export const agentPreviewResponseSchema = z.object({
  reply: z.string().max(agentSettingsLimits.previewMessage),
  mode: z.enum(["model", "sample"]),
});

export type AgentSettingsResponse = z.infer<typeof agentSettingsResponseSchema>;

export type SaveAgentSettings = z.infer<typeof saveAgentSettingsSchema>;

export type AgentPreviewMessage = z.infer<typeof agentPreviewMessageSchema>;

export type AgentPreview = z.infer<typeof agentPreviewSchema>;

export type AgentPreviewResponse = z.infer<typeof agentPreviewResponseSchema>;
