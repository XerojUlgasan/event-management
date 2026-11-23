import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

let server,
  cacheDir,
  ui,
  MessagesWorkspace,
  MessageProcessing,
  MessageImages,
  CustomerEventTimeline,
  CatalogRecommendations;

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
  ({ CustomerEventTimeline } = await server.ssrLoadModule(
    "/src/components/booking-requests/CustomerEventTimeline.tsx",
  ));
  ({ CatalogRecommendations } = await server.ssrLoadModule(
    "/src/components/messages/CatalogRecommendations.tsx",
  ));
  ({ MessageProcessing } = await server.ssrLoadModule(
    "/src/components/messages/MessageProcessing.tsx",
  ));
  ({ MessageImages } = await server.ssrLoadModule(
    "/src/components/messages/MessageImages.tsx",
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

test("pending processing phases stay hidden while authorized failure retry remains", () => {
  const render = (status, canRetry = false) =>
    renderToStaticMarkup(
      createElement(MessageProcessing, {
        message: {
          ...message("image", "customer", ""),
          processing: { status, canRetry, errorCode: null },
        },
        onRetry: async () => {},
      }),
    );

  for (const status of ["queued", "interpreting", "replying"])
    assert.equal(render(status), "");

  assert.match(render("failed", true), /message was saved.*Retry processing/);
  assert.doesNotMatch(render("failed"), /Retry processing/);
  assert.equal(render("completed"), "");
  assert.equal(render("suppressed"), "");
});

test("images load only after interpretation; pending and failed originals remain hidden", () => {
  const render = (status) =>
    renderToStaticMarkup(
      createElement(MessageImages, {
        message: {
          ...message("image", "customer", ""),
          processing: {
            status,
            canRetry: status === "failed",
            errorCode: null,
          },
          images: [
            { id: "pending", interpretation: null, url: "/secret-pending" },
            {
              id: "ready",
              interpretation: { summary: "A photo" },
              url: "/safe-image",
            },
          ],
        },
      }),
    );

  for (const status of ["queued", "interpreting", "replying"]) {
    const html = render(status);
    assert.match(html, /Image attachment/);
    assert.doesNotMatch(html, /secret-pending/);
    assert.match(html, /safe-image/);
  }

  const failed = render("failed");
  assert.match(failed, /Image unavailable/);
  assert.doesNotMatch(failed, /secret-pending/);
  assert.match(failed, /safe-image/);
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
  aiEnabled: true,
  aiVersion: 0,
  lastMessage: messages.at(-1),
  unreadCount: 0,
  updatedAt: "2026-11-19T08:00:00.000Z",
};

for (const viewerRole of ["customer", "admin"]) {
  test(`${viewerRole} sees processing retry only for permitted message sources`, () => {
    const failed = (id, role) => ({
      ...message(id, role, `${role} image`),
      processing: {
        status: "failed",
        canRetry: true,
        errorCode: "vision_unavailable",
      },
    });

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
          messages: [
            failed("customer-image", "customer"),
            failed("admin-image", "admin"),
          ],
          loading: false,
          error: null,
          async onSend() {},
          async onRetryProcessing() {},
          conversationOpen: true,
          listEmpty: { title: "Empty", body: "No conversations" },
          threadEmpty: { title: "Empty", body: "No messages" },
        }),
      ),
    );

    assert.equal(
      (html.match(/Retry processing/g) ?? []).length,
      viewerRole === "admin" ? 2 : 1,
    );
    assert.equal((html.match(/Your message was saved/g) ?? []).length, 2);
  });
}

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

test("assistant typing status is accessible and decorative dots are hidden", () => {
  const html = renderToStaticMarkup(createElement(ui.AssistantTyping));
  assert.match(html, /role="status"/);
  assert.match(html, /aria-label="AI is preparing a reply"/);
  assert.match(html, /aria-hidden="true"/);
  assert.equal((html.match(/<i>/g) ?? []).length, 3);
});

for (const viewerRole of ["customer", "admin"]) {
  test(`${viewerRole} sees one typing indicator only when AI reply is pending`, () => {
    const render = (active) =>
      renderToStaticMarkup(
        createElement(
          ui.NotificationProvider,
          null,
          createElement(MessagesWorkspace, {
            title: "Messages",
            viewerRole,
            conversations: [active],
            activeConversation: active,
            activeId: active.id,
            onSelect() {},
            messages,
            loading: false,
            error: null,
            async onSend() {},
            conversationOpen: true,
            listEmpty: { title: "Empty", body: "Empty" },
            threadEmpty: { title: "Empty", body: "Empty" },
          }),
        ),
      );

    assert.equal(
      (
        render({ ...conversation, aiReplyPending: true }).match(
          /AI is preparing a reply/g,
        ) ?? []
      ).length,
      1,
    );
    assert.doesNotMatch(
      render({ ...conversation, aiReplyPending: true, aiEnabled: false }),
      /AI is preparing a reply/,
    );
  });
}

for (const viewerRole of ["customer", "admin"]) {
  test(`${viewerRole} can use a booking conversation without lifecycle fields`, () => {
    const bookingConversation = {
      ...conversation,
      bookingRequestId: "booking",
    };

    const html = renderToStaticMarkup(
      createElement(
        ui.NotificationProvider,
        null,
        createElement(MessagesWorkspace, {
          title: "Messages",
          viewerRole,
          conversations: [bookingConversation],
          activeConversation: bookingConversation,
          activeId: bookingConversation.id,
          onSelect() {},
          onToggleAi() {},
          messages,
          loading: false,
          error: null,
          async onSend() {},
          conversationOpen: true,
          listEmpty: { title: "Empty", body: "Empty" },
          threadEmpty: { title: "Empty", body: "Empty" },
        }),
      ),
    );

    assert.match(html, /aria-label="Write a message"/);
    assert.doesNotMatch(html, /conversation is closed|>Closed</);

    if (viewerRole === "admin") {
      assert.match(html, /aria-label="AI replies"/);
      assert.doesNotMatch(html, /aria-label="AI replies"[^>]*disabled/);
    }
  });
}

test("booking chat uses event and requested date instead of its reference", () => {
  const linked = {
    ...conversation,
    bookingRequestId: "booking-id",
    bookingRequestReference: "BR-RANDOM-REFERENCE",
    eventType: "Birthday",
    eventPreferredDate: "2026-11-15",
    eventStartsAt: null,
  };

  const html = renderToStaticMarkup(
    createElement(
      ui.NotificationProvider,
      null,
      createElement(MessagesWorkspace, {
        title: "Messages",
        viewerRole: "customer",
        conversations: [linked],
        activeId: linked.id,
        onSelect() {},
        messages: [],
        loading: false,
        error: null,
        async onSend() {},
        conversationOpen: true,
        listEmpty: { title: "Empty", body: "No conversations" },
        threadEmpty: { title: "Empty", body: "No messages" },
      }),
    ),
  );

  assert.match(html, /Birthday/);
  assert.match(html, /Nov 15, 2026/);
  assert.doesNotMatch(html, /BR-RANDOM-REFERENCE/);
});

test("event cards use human-readable accessible labels", () => {
  const item = {
    id: "request-id",
    reference: "BR-RANDOM-REFERENCE",
    eventType: "Birthday",
    packageName: "Celebration",
    status: "under_review",
    timeZone: "Asia/Manila",
    preferredDate: "2026-11-15",
    requestedDays: [{ date: "2026-11-15", startsAt: null, endsAt: null }],
  };

  const html = renderToStaticMarkup(
    createElement(CustomerEventTimeline, {
      items: [item],
      now: new Date("2026-11-14T12:00:00Z"),
      hasMore: false,
      onDetails() {},
      onOpenChat() {},
    }),
  );

  assert.match(html, /aria-label="Open chat for Birthday · Nov 15, 2026"/);
  assert.match(html, /aria-label="View details for Birthday · Nov 15, 2026"/);
  assert.doesNotMatch(html, /BR-RANDOM-REFERENCE/);
});

test("catalog recommendations render ordered snapshot terms with public links", () => {
  const recommendations = [
    {
      type: "package",
      id: "package-id",
      slug: "garden-package",
      name: "Garden Celebration",
      description: "A relaxed garden event.",
      imageUrl: null,
      price: { kind: "fixed", currency: "PHP", amountMinor: 1250000 },
      maxGuests: 80,
      inclusions: [
        { name: "Catering", includedHours: 4, hourlyRatePesos: null },
        { name: "Styling", includedHours: null, hourlyRatePesos: null },
        { name: "Sound", includedHours: null, hourlyRatePesos: null },
      ],
    },
    {
      type: "service",
      id: "service-id",
      slug: "live-music",
      name: "Live Music",
      description: "Acoustic music for your event.",
      imageUrl: null,
      fixedPricePesos: 5000,
      hourlyRatePesos: 1200,
      includedHours: 3,
    },
  ];
  const html = renderToStaticMarkup(
    createElement(CatalogRecommendations, { recommendations }),
  );

  assert.ok(html.indexOf("Garden Celebration") < html.indexOf("Live Music"));
  assert.match(html, /href="\/packages\/garden-package\?catalogId=package-id"/);
  assert.match(html, /href="\/services\/live-music\?catalogId=service-id"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /includes Catering \(4 hours\), Styling, and more/i);
  assert.match(html, /Up to 80 guests/);
  assert.match(html, /opens in a new tab/);

  assert.equal(
    renderToStaticMarkup(createElement(CatalogRecommendations, {})),
    "",
  );
});
