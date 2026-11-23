import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { Window } from "happy-dom";
import { createServer } from "vite";

const labels = ["Oo, tingnan natin ang packages.", "May sarili akong venue."];

const timestamp = "2026-11-23T03:00:00.000Z";

const message = (id, senderRole, fields = {}) => ({
  id,
  senderRole,
  senderName: senderRole === "assistant" ? "AMAC AI" : "Customer",
  body: "Some message content",
  createdAt: timestamp,
  ...fields,
});

const legacyReply = message("legacy-reply", "assistant", {
  body: "View packages and View services",
  createdAt: "2026-11-23T02:59:00.000Z",
});

const question = message("question", "customer", {
  catalogBrowse: ["services"],
});

const prompt = message("prompt", "assistant", {
  replyToMessageId: question.id,
  suggestedReplies: labels,
  catalogBrowse: ["packages", "services"],
});

const conversation = {
  id: "conversation",
  customerName: "Example customer",
  lastMessage: prompt,
  aiEnabled: true,
  aiVersion: 1,
  unreadCount: 0,
  updatedAt: timestamp,
};

const handoff = {
  ...prompt,
  body: "I’ve handed this over to our team.",
  handoffAcknowledgement: true,
};

const handedOffConversation = {
  ...conversation,
  lastMessage: handoff,
  aiEnabled: false,
  aiVersion: 2,
};

test("catalog browse and suggested replies coexist in both customer chats", async (t) => {
  const window = new Window();
  const cacheDir = await mkdtemp(join(tmpdir(), "clemora-suggested-replies-"));
  const server = await createServer({
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
  t.after(async () => {
    await server.close();
    window.close();
    await rm(cacheDir, { recursive: true, force: true });
  });

  for (const [name, value] of Object.entries({
    window,
    document: window.document,
    Element: window.Element,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { value, configurable: true });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, name, original);
      else delete globalThis[name];
    });
  }

  const { act, createElement } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { NotificationProvider } = await server.ssrLoadModule(
    "@event-management/ui",
  );
  const { MessagesWorkspace } = await server.ssrLoadModule(
    "/src/components/messages/MessagesWorkspace.tsx",
  );
  const { default: PublicChat } = await server.ssrLoadModule(
    "/src/components/public/site/PublicChat.tsx",
  );
  const container = window.document.createElement("div");
  window.document.body.append(container);

  const choices = () => [
    ...container.querySelectorAll('[aria-label="Suggested replies"] button'),
  ];

  const browseButtons = () =>
    [...container.querySelectorAll('button[aria-haspopup="dialog"]')].filter(
      (button) => /^View (packages|services)\b/.test(button.textContent),
    );

  function catalogResponse(url, options) {
    const kind = new URL(url).pathname.split("/").at(-1);

    if (kind !== "packages" && kind !== "services") return;

    assert.equal(options.method, "GET");

    return Response.json({ [kind]: [], nextCursor: null });
  }

  const draft = "This is my own reply.";
  const file = new File(["image"], "draft.png", { type: "image/png" });

  async function fillComposer() {
    const textarea = container.querySelector("textarea");
    const input = container.querySelector('input[type="file"]');
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    ).set;
    await act(async () => {
      setValue.call(textarea, draft);
      textarea.dispatchEvent(new window.Event("input", { bubbles: true }));
      Object.defineProperty(input, "files", {
        value: [file],
        configurable: true,
      });
      input.dispatchEvent(new window.Event("change", { bubbles: true }));
    });

    return textarea;
  }

  async function checkBrowseDialog(kind, textarea) {
    const buttons = browseButtons();
    assert.deepEqual(
      buttons.map((button) =>
        button.textContent.trim().split(/\s+/).slice(0, 2).join(" "),
      ),
      ["View packages", "View services"],
    );
    assert.equal(
      buttons[0].parentElement.previousElementSibling.dataset.messageId,
      prompt.id,
    );

    const opener = buttons.find((button) =>
      button.textContent.startsWith(`View ${kind}`),
    );

    const thread = opener.closest(".message-thread, .chat-messages");

    thread.scrollTop = 23;
    await act(async () => opener.click());
    const dialog = window.document.querySelector("dialog[open]");
    assert.ok(dialog);
    const title = window.document.getElementById(
      dialog.getAttribute("aria-labelledby"),
    );
    assert.equal(title.textContent.toLowerCase(), kind);
    assert.match(dialog.textContent, new RegExp(`Showing 0 ${kind}`));

    const filters = dialog.querySelector('[aria-label="Show filters"]');
    const close = dialog.querySelector('[aria-label="Close catalog"]');
    assert.equal(window.document.activeElement, close);
    await act(async () => filters.click());
    assert.equal(filters.getAttribute("aria-expanded"), "true");

    thread.scrollTop = 8;
    await act(async () => close.click());
    assert.equal(window.document.querySelector("dialog[open]"), null);
    assert.equal(window.document.activeElement, opener);
    assert.equal(thread.scrollTop, 23);
    assert.equal(textarea.value, draft);
    assert.ok(container.querySelector('[aria-label="Remove draft.png"]'));
  }

  await t.test(
    "signed-in browse opens from an assistant reply while admins see no customer actions",
    async (t) => {
      t.mock.method(
        globalThis,
        "fetch",
        async (url, options) =>
          catalogResponse(url, options) ?? new Response(null, { status: 404 }),
      );
      const root = createRoot(container);
      const empty = { title: "Empty", body: "Start a conversation" };
      const sent = [];

      const render = (
        messages,
        viewerRole = "customer",
        { activeConversation = conversation, sendDisabled = false } = {},
      ) =>
        act(async () =>
          root.render(
            createElement(
              NotificationProvider,
              null,
              createElement(MessagesWorkspace, {
                title: "Messages",
                viewerRole,
                conversations: [activeConversation],
                activeId: conversation.id,
                onSelect() {},
                messages,
                loading: false,
                error: null,
                sendDisabled,
                async onSend(body, files, requestId, reviewMessageId) {
                  sent.push({ body, files, requestId, reviewMessageId });
                },
                conversationOpen: true,
                listEmpty: empty,
                threadEmpty: empty,
              }),
            ),
          ),
        );

      try {
        await render([legacyReply, question, prompt], "admin");
        assert.equal(choices().length, 0);
        assert.equal(browseButtons().length, 0);
        await render([question, handoff], "customer", {
          activeConversation: handedOffConversation,
          sendDisabled: true,
        });
        assert.equal(choices().length, 0);

        const laterCustomer = message("new-input", "customer");
        const currentPrompt = message("current-prompt", "assistant", {
          replyToMessageId: laterCustomer.id,
          suggestedReplies: labels,
        });

        for (const messages of [
          [question, prompt, laterCustomer],
          [question, laterCustomer, prompt],
          [laterCustomer, prompt],
          [laterCustomer, currentPrompt, message("team", "admin"), prompt],
          [
            laterCustomer,
            currentPrompt,
            { ...currentPrompt, id: "empty-current", suggestedReplies: [] },
            prompt,
          ],
          [question, prompt, message("legacy", "assistant")],
          [question, prompt, message("team", "admin")],
          [
            question,
            prompt,
            message("invalid", "assistant", { suggestedReplies: [42] }),
          ],
          [
            question,
            prompt,
            message("empty", "assistant", { suggestedReplies: [] }),
          ],
        ]) {
          await render(messages);
          assert.equal(choices().length, 0);
        }

        await render([question, laterCustomer, currentPrompt, prompt]);
        assert.equal(
          choices()[0].parentElement.previousElementSibling.dataset.messageId,
          currentPrompt.id,
        );

        // The trigger can be on an older page of a valid current reply.
        await render([prompt]);
        assert.equal(choices().length, labels.length);

        const previousReview = message("older-review", "assistant");
        await render([previousReview]);
        const textarea = await fillComposer();
        await render(
          [legacyReply, previousReview, question, laterCustomer, handoff],
          "customer",
          {
            activeConversation: handedOffConversation,
          },
        );
        const buttons = choices();
        assert.deepEqual(
          buttons.map((button) => button.textContent),
          labels,
        );
        assert.equal(
          buttons[0].parentElement.previousElementSibling,
          browseButtons()[0].parentElement,
        );
        await checkBrowseDialog("packages", textarea);
        assert.equal(sent.length, 0);
        await act(async () => {
          buttons[0].click();
          buttons[1].click();
        });
        assert.deepEqual(sent, [
          {
            body: labels[0],
            files: [],
            requestId: sent[0]?.requestId,
            reviewMessageId: undefined,
          },
        ]);
        assert.ok(sent[0].requestId);
        assert.equal(textarea.value, draft);
        assert.ok(container.querySelector('[aria-label="Remove draft.png"]'));

        await act(async () =>
          container.querySelector('[aria-label="Remove draft.png"]').click(),
        );
        await act(async () => textarea.form.requestSubmit());
        assert.equal(sent[1].body, draft);
        assert.equal(sent[1].reviewMessageId, previousReview.id);
        assert.notEqual(sent[1].requestId, sent[0].requestId);

        await render([question, { ...prompt, id: "another-prompt" }]);
        await fillComposer();
        const [nextButton] = choices();
        await act(async () => {
          textarea.form.requestSubmit();
          nextButton.click();
        });
        assert.equal(sent.length, 3);
        assert.equal(sent[2].body, draft);
        assert.deepEqual(sent[2].files, [file]);
      } finally {
        await act(async () => root.unmount());
      }
    },
  );

  await t.test(
    "guest browse preserves the allowance and a handoff suggestion spends one message",
    async (t) => {
      const root = createRoot(container);
      const sends = [];

      const guest = (remainingMessages) => ({
        remainingMessages,
        loginRequired: remainingMessages === 0,
      });

      t.mock.method(globalThis, "fetch", async (url, options) => {
        const catalog = catalogResponse(url, options);

        if (catalog) return catalog;

        if (url.endsWith("/me")) return new Response(null, { status: 401 });

        if (url.endsWith("/guest/conversation"))
          return Response.json({
            conversation: handedOffConversation,
            messages: [
              legacyReply,
              question,
              message("new-input", "customer"),
              handoff,
            ],
            nextCursor: null,
            guest: guest(2),
          });

        if (url.endsWith("/guest/conversations/conversation/messages")) {
          const payload =
            options.body instanceof FormData
              ? Object.fromEntries(options.body)
              : JSON.parse(options.body);
          sends.push(payload);

          return Response.json({
            message: message(payload.requestId, "customer", {
              body: payload.body,
              createdAt: new Date().toISOString(),
            }),
            assistantMessage:
              sends.length === 2
                ? {
                    ...prompt,
                    id: "final-guest-reply",
                    replyToMessageId: payload.requestId,
                    createdAt: new Date().toISOString(),
                  }
                : null,
            assistantError: null,
            guest: guest(2 - sends.length),
          });
        }

        return new Response(null, { status: 404 });
      });

      try {
        await act(async () => root.render(createElement(PublicChat)));
        await act(async () =>
          container.querySelector(".public-chat-trigger").click(),
        );
        const textarea = await fillComposer();
        const buttons = choices();
        assert.deepEqual(
          buttons.map((button) => button.textContent),
          labels,
        );
        await checkBrowseDialog("services", textarea);
        assert.equal(sends.length, 0);
        assert.match(
          container.querySelector(".handover").textContent,
          /2 guest messages remaining/,
        );
        await act(async () => {
          buttons[0].click();
          buttons[1].click();
        });
        assert.equal(sends.length, 1);
        assert.deepEqual(sends[0], {
          body: labels[0],
          requestId: sends[0].requestId,
        });
        assert.ok(sends[0].requestId);
        assert.equal(choices().length, 0);
        assert.equal(textarea.value, draft);
        assert.ok(container.querySelector('[aria-label="Remove draft.png"]'));
        assert.match(
          container.querySelector(".handover").textContent,
          /1 guest messages remaining/,
        );

        await act(async () => textarea.form.requestSubmit());
        assert.equal(sends.length, 2);
        assert.equal(sends[1].body, draft);
        assert.equal(sends[1].images.name, file.name);
        assert.ok(container.querySelector(".chat-signin"));
        assert.ok(
          container.querySelector('[data-message-id="final-guest-reply"]'),
        );
        assert.equal(choices().length, 0);
      } finally {
        await act(async () => root.unmount());
      }
    },
  );
});
