import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

let server, cacheDir, ui, MessagesWorkspace;

before(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), "clemora-message-markdown-"));
  server = await createServer({
    root: fileURLToPath(new URL("../../", import.meta.url)),
    cacheDir,
    configFile: false,
    appType: "custom",
    server: { middlewareMode: true },
    esbuild: { jsx: "automatic" },
    resolve: {
      noExternal: ["@uiw/react-markdown-preview"],
      external: ["@babel/runtime"],
    },
    logLevel: "silent",
  });
  ui = await server.ssrLoadModule("@event-management/ui");
  ({ MessagesWorkspace } = await server.ssrLoadModule(
    "/src/components/messages/MessagesWorkspace.tsx",
  ));
});
after(async () => {
  try {
    await server?.close();
  } finally {
    if (cacheDir) await rm(cacheDir, { recursive: true, force: true });
  }
});

const renderMarkdown = (source, variant = "message") =>
  renderToStaticMarkup(createElement(ui.Markdown, { source, variant }));

const source = `## Event details

**Bold** and *italic*, with [details](https://example.com).

- Ceremony
- Reception

1. Share a date
2. Share a guest count

> A quotation is prepared separately.

Use \`Shift+Enter\`.

\`\`\`text
wide code content
\`\`\`

| Option | Guests |
| --- | --- |
| Celebration | 50 |`;

test("the shared renderer formats message Markdown without changing its source", () => {
  const html = renderMarkdown(source);

  for (const pattern of [
    /<h2[^>]*>/,
    /<strong>Bold<\/strong>/,
    /<em>italic<\/em>/,
    /href="https:\/\/example.com"/,
    /<ul>/,
    /<ol>/,
    /<blockquote>/,
    /<code>Shift\+Enter<\/code>/,
    /<pre[\s>]/,
    /<table>/,
    /<td>50<\/td>/,
    /ui-markdown-message/,
  ])
    assert.match(html, pattern);
});

test("ordinary message line breaks and blank lines remain available to presentation", () => {
  const html = renderMarkdown("First line\nSecond line\n\nLast paragraph");
  assert.match(html, /<p>First line\nSecond line<\/p>/);
  assert.match(html, /<p>Last paragraph<\/p>/);
  const hardBreak = renderMarkdown("First line  \nSecond line");
  assert.match(hardBreak, /First line<br\s*\/?\s*>Second line/);
  assert.doesNotMatch(hardBreak, /<br\s*\/?\s*>\n/);
});

test("both variants sanitize untrusted content and preserve safe links", () => {
  const unsafe = `**Safe**\n\n<script>alert(1)</script>\n\n<img src="/safe.png" onerror="alert(1)">\n\n[Bad](javascript:alert(1))\n\n[Good](https://example.com)\n\n![Image](/safe.png)`;

  for (const variant of ["message", "document"]) {
    const html = renderMarkdown(unsafe, variant);
    assert.match(html, /<strong>Safe<\/strong>/);
    assert.match(html, /href="https:\/\/example.com"/);
    assert.doesNotMatch(html, /<script|onerror=|javascript:/i);
  }
});

test("message images show their alt text without loading sender-supplied URLs", () => {
  const source = "![Table setting](https://example.com/tracking.png)";
  const html = renderMarkdown(source);
  assert.match(html, /Table setting/);
  assert.doesNotMatch(html, /<img|https:\/\/example.com\/tracking.png/);
  assert.match(
    renderMarkdown(source, "document"),
    /<img[^>]*alt="Table setting"/,
  );
});

const message = (id, senderRole, body, quotationId = null) => ({
  id,
  senderRole,
  senderId: senderRole === "assistant" ? null : senderRole,
  senderName: senderRole === "assistant" ? "AMAC AI" : senderRole,
  body,
  quotationId,
  createdAt: "2026-11-19T08:00:00.000Z",
  readAt: null,
});

const messages = [
  message("customer", "customer", "**Customer text**"),
  message("assistant", "assistant", "*Assistant text*"),
  message("admin", "admin", "[Admin text](https://example.com)"),
  message("quotation", "admin", "**Quotation notice**", "quotation-version"),
];

const conversation = {
  id: "thread",
  customerId: "customer",
  customerName: "Example customer",
  customerEmail: "example@example.com",
  bookingRequestId: null,
  status: "active",
  aiEnabled: true,
  aiVersion: 0,
  lastMessage: messages.at(-1),
  unreadCount: 0,
  updatedAt: "2026-11-19T08:00:00.000Z",
};

for (const viewerRole of ["customer", "admin"]) {
  test(`${viewerRole} workspace formats all senders and preserves quotation and retry controls`, () => {
    const html = renderToStaticMarkup(
      createElement(
        ui.NotificationProvider,
        null,
        createElement(MessagesWorkspace, {
          title: "Messages",
          viewerRole,
          conversations: [conversation],
          activeId: conversation.id,
          onSelect() {},
          messages,
          loading: false,
          error: null,
          async onSend() {},
          failedMessageIds: ["customer"],
          onRetryMessage() {},
          conversationOpen: true,
          listEmpty: { title: "Empty", body: "No conversations" },
          threadEmpty: { title: "Empty", body: "No messages" },
        }),
      ),
    );

    assert.match(html, /<strong>Customer text<\/strong>/);
    assert.match(html, /<em>Assistant text<\/em>/);
    assert.match(html, /<a href="https:\/\/example.com">Admin text<\/a>/);
    assert.equal((html.match(/ui-markdown-message/g) ?? []).length, 3);
    assert.match(html, /message-quotation/);
    assert.match(html, /<p>\*\*Quotation notice\*\*<\/p>/);
    assert.match(html, /View quotation/);
    assert.match(html, /Delivery could not be confirmed/);
    assert.match(html, />Retry<\/button>/);
    assert.equal(messages[0].body, "**Customer text**");
  });
}
