import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { Window } from "happy-dom";
import { createServer } from "vite";

test("a customer can return to a single conversation in the inbox and reopen its draft", async (t) => {
  const window = new Window();
  const cacheDir = await mkdtemp(join(tmpdir(), "amac-conversation-draft-"));
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

  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response(null, { status: 404 }),
  );

  for (const [name, value] of Object.entries({
    window,
    document: window.document,
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
  const container = window.document.createElement("div");
  window.document.body.append(container);
  const root = createRoot(container);
  const conversation = {
    id: "customer-thread",
    customerName: "Example customer",
    lastMessage: null,
    unreadCount: 0,
    updatedAt: "2026-11-19T08:00:00.000Z",
  };
  const empty = { title: "Empty", body: "Start a conversation" };
  const sent = [];

  try {
    const render = (conversationOpen) =>
      root.render(
        createElement(
          NotificationProvider,
          null,
          createElement(MessagesWorkspace, {
            viewerRole: "customer",
            conversations: [conversation],
            activeId: conversation.id,
            onSelect: () => render(true),
            onBack: () => render(false),
            messages: [],
            loading: false,
            error: null,
            async onSend(body, files) {
              sent.push({ body, files });
            },
            conversationOpen,
            listEmpty: empty,
            threadEmpty: empty,
          }),
        ),
      );

    await act(async () => render(true));

    const preview = container.querySelector("aside button > span:nth-child(2)");
    const textarea = container.querySelector("textarea");
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    ).set;
    const emptyPreview = "General questionsNo messages yet";
    assert.equal(preview.textContent, emptyPreview);

    await act(async () => {
      setValue.call(textarea, "Hello");
      textarea.dispatchEvent(new window.Event("input", { bubbles: true }));
    });
    assert.equal(
      preview.querySelector(".conversation-draft")?.textContent,
      "Draft",
    );
    const back = container.querySelector(
      '[aria-label="Back to conversations"]',
    );
    assert.ok(back);
    await act(async () => back.click());
    assert.equal(container.querySelector(".conversation-open"), null);
    await act(async () => preview.closest("button").click());
    assert.ok(container.querySelector(".conversation-open"));
    assert.equal(textarea.value, "Hello");

    await act(async () => textarea.form.requestSubmit());
    assert.deepEqual(sent, [{ body: "Hello", files: [] }]);
    assert.equal(preview.textContent, emptyPreview);

    const input = container.querySelector('input[type="file"]');
    const file = new File(["image"], "example.png", { type: "image/png" });
    Object.defineProperty(input, "files", { value: [file] });
    await act(async () =>
      input.dispatchEvent(new window.Event("change", { bubbles: true })),
    );
    assert.equal(
      preview.querySelector(".conversation-draft")?.textContent,
      "Draft",
    );
    await act(async () =>
      container
        .querySelector('button[aria-label="Remove example.png"]')
        .click(),
    );
    assert.equal(preview.textContent, emptyPreview);
  } finally {
    await act(async () => root.unmount());
  }
});
