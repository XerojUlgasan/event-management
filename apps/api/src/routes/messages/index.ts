import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { createMiddleware } from "hono/factory";
import { requireSession } from "../../middleware/auth.js";
import type { HonoEnv } from "../../types/hono.js";
import {
  conversationsSchema,
  errorSchema,
  messageBodySchema,
  messageResultSchema,
  threadSchema,
} from "./schemas.js";
import {
  conversationDto,
  createMessage,
  ensureConversation,
  findConversation,
  listConversations,
  markRead,
  messageDto,
  threadMessages,
} from "./store.js";

const routes = new OpenAPIHono<HonoEnv>({
  defaultHook: (result, c) => {
    if (!result.success)
      return c.json(
        {
          error: result.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; "),
        },
        400,
      );
  },
});

const json = <T extends z.ZodType>(schema: T) => ({ "application/json": { schema } });
const errors = {
  400: { content: json(errorSchema), description: "Invalid message" },
  401: { content: json(errorSchema), description: "Not signed in" },
  403: { content: json(errorSchema), description: "Wrong account role" },
  404: { content: json(errorSchema), description: "Conversation not found" },
};
const idParams = z.object({ id: z.string().uuid() });
const body = <T extends z.ZodType>(schema: T) => ({ required: true as const, content: json(schema) });

const customerOnly = createMiddleware<HonoEnv>(async (c, next) => {
  if (c.get("session").user.role !== "customer")
    return c.json({ error: "Customer access required" }, 403);
  await next();
});
const adminOnly = createMiddleware<HonoEnv>(async (c, next) => {
  if (c.get("session").user.role !== "admin")
    return c.json({ error: "Admin access required" }, 403);
  await next();
});

routes.use("/messages", requireSession, customerOnly);
routes.use("/messages/*", requireSession, customerOnly);
routes.use("/admin/conversations", requireSession, adminOnly);
routes.use("/admin/conversations/*", requireSession, adminOnly);

const getMyConversation = createRoute({
  method: "get",
  path: "/messages/conversation",
  tags: ["Messages"],
  summary: "Read the signed-in customer's conversation with the Clemora team",
  responses: {
    200: { content: json(threadSchema), description: "Conversation and messages" },
    401: errors[401],
    403: errors[403],
  },
});
routes.openapi(getMyConversation, async (c) => {
  const db = c.get("db");
  const user = c.get("session").user;
  const conversation = await ensureConversation(db, user.id);
  await markRead(db, conversation, "customer");
  const rows = await threadMessages(db, conversation.id);
  const messages = rows.map((row) => messageDto(row, conversation.customer_id));
  return c.json(
    {
      conversation: conversationDto(conversation, messages.at(-1) ?? null, 0),
      messages,
    },
    200,
  );
});

const sendMyMessage = createRoute({
  method: "post",
  path: "/messages/conversation/messages",
  tags: ["Messages"],
  summary: "Send a message to the Clemora team",
  request: { body: body(messageBodySchema) },
  responses: {
    201: { content: json(messageResultSchema), description: "Message sent" },
    400: errors[400],
    401: errors[401],
    403: errors[403],
  },
});
routes.openapi(sendMyMessage, async (c) => {
  const db = c.get("db");
  const user = c.get("session").user;
  const conversation = await ensureConversation(db, user.id);
  const message = await createMessage(db, conversation, user.id, c.req.valid("json").body);
  return c.json({ message }, 201);
});

const listAdminConversations = createRoute({
  method: "get",
  path: "/admin/conversations",
  tags: ["Messages"],
  summary: "List customer conversations for staff",
  responses: {
    200: { content: json(conversationsSchema), description: "Conversations with unread counts" },
    401: errors[401],
    403: errors[403],
  },
});
routes.openapi(listAdminConversations, async (c) =>
  c.json({ conversations: await listConversations(c.get("db")) }, 200),
);

const getAdminConversation = createRoute({
  method: "get",
  path: "/admin/conversations/{id}",
  tags: ["Messages"],
  summary: "Read a customer conversation as staff",
  request: { params: idParams },
  responses: {
    200: { content: json(threadSchema), description: "Conversation and messages" },
    ...errors,
  },
});
routes.openapi(getAdminConversation, async (c) => {
  const db = c.get("db");
  const conversation = await findConversation(db, c.req.valid("param").id);
  if (!conversation) return c.json({ error: "Conversation not found" }, 404);
  await markRead(db, conversation, "admin");
  const rows = await threadMessages(db, conversation.id);
  const messages = rows.map((row) => messageDto(row, conversation.customer_id));
  return c.json(
    {
      conversation: conversationDto(conversation, messages.at(-1) ?? null, 0),
      messages,
    },
    200,
  );
});

const sendAdminMessage = createRoute({
  method: "post",
  path: "/admin/conversations/{id}/messages",
  tags: ["Messages"],
  summary: "Reply to a customer as staff",
  request: { params: idParams, body: body(messageBodySchema) },
  responses: {
    201: { content: json(messageResultSchema), description: "Reply sent" },
    ...errors,
  },
});
routes.openapi(sendAdminMessage, async (c) => {
  const db = c.get("db");
  const conversation = await findConversation(db, c.req.valid("param").id);
  if (!conversation) return c.json({ error: "Conversation not found" }, 404);
  const message = await createMessage(
    db,
    conversation,
    c.get("session").user.id,
    c.req.valid("json").body,
  );
  return c.json({ message }, 201);
});

export default routes;
