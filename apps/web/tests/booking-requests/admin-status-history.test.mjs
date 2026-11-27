import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { Window } from "happy-dom";
import { createServer } from "vite";

test("admin status history appends, retries, and resets on a new revision", async (t) => {
  const window = new Window({ url: "http://localhost/" });
  const globals = {
    window,
    document: window.document,
    navigator: window.navigator,
    HTMLElement: window.HTMLElement,
    HTMLDialogElement: window.HTMLDialogElement,
    Element: window.Element,
    MutationObserver: window.MutationObserver,
    IS_REACT_ACT_ENVIRONMENT: true,
  };

  for (const [name, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, name, {
      value,
      configurable: true,
      writable: true,
    });
  }

  t.after(async () => {
    await window.happyDOM.abort();
    window.close();
  });

  const requests = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (url) =>
    new Promise((resolve) => requests.push({ url: new URL(url), resolve }));
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const { act, createElement } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const cacheDir = await mkdtemp(join(tmpdir(), "amac-admin-status-"));
  const vite = await createServer({
    root: fileURLToPath(new URL("../../", import.meta.url)),
    cacheDir,
    configFile: false,
    appType: "custom",
    server: { middlewareMode: true, hmr: false },
    esbuild: { jsx: "automatic" },
    resolve: {
      noExternal: ["@uiw/react-markdown-preview"],
      external: ["@babel/runtime"],
    },
    ssr: {
      noExternal: [
        "@uiw/react-markdown-preview",
        "@uiw/react-md-editor",
        "@event-management/ui",
      ],
    },
    logLevel: "silent",
  });

  t.after(async () => {
    await vite.close();
    await rm(cacheDir, { recursive: true, force: true });
  });

  const { AdminBookingStatusHistory } = await vite.ssrLoadModule(
    "/src/components/workspaces/admin/booking-requests/AdminBookingStatusHistory.tsx",
  );
  const { NotificationProvider } = await vite.ssrLoadModule(
    "/@fs" +
      fileURLToPath(
        new URL(
          "../../../../packages/ui/src/molecules/NotificationProvider.tsx",
          import.meta.url,
        ),
      ),
  );
  const container = window.document.body.appendChild(
    window.document.createElement("div"),
  );
  const root = createRoot(container);

  t.after(() => act(async () => root.unmount()));

  const render = (revision) =>
    act(async () => {
      root.render(
        createElement(
          NotificationProvider,
          null,
          createElement(AdminBookingStatusHistory, {
            id: "booking-1",
            revision,
            timeZone: "Asia/Manila",
          }),
        ),
      );
    });

  const respond = (index, body, status = 200) =>
    act(async () => {
      requests[index].resolve(Response.json(body, { status }));
    });

  const click = async (label) => {
    const button = container.querySelector("button");

    assert.equal(button.textContent, label);
    await act(async () => button.click());
  };

  const statuses = () =>
    [...container.querySelectorAll("ol.booking-status-timeline li strong")].map(
      (element) => element.textContent,
    );

  const createdAt = "2026-11-24T00:30:00.000Z";

  const entry = (status, reason = null) => ({
    id: status,
    status,
    reason,
    changedBy: "actor",
    createdAt,
  });

  const nextCursor = "next+/=";

  await render("first");
  assert.equal(
    requests[0].url.pathname,
    "/v1/admin/booking-requests/booking-1/status-history",
  );
  assert.equal(requests[0].url.search, "?order=newest");
  await respond(0, {
    history: [entry("needs_details", "Please confirm the guest count.")],
    nextCursor,
  });
  assert.deepEqual(statuses(), ["Needs details"]);
  assert.equal(container.querySelector("li time").dateTime, createdAt);
  assert.equal(
    container.querySelector("li p").textContent,
    "Please confirm the guest count.",
  );
  await click("Load older changes");
  assert.equal(requests[1].url.searchParams.get("cursor"), nextCursor);
  assert.equal(container.querySelector("button").disabled, true);
  assert.deepEqual(statuses(), ["Needs details"]);
  await respond(1, { error: "Temporary error" }, 500);
  assert.deepEqual(statuses(), ["Needs details"]);
  assert.equal(
    container.querySelector("[role=alert]").textContent,
    "Unable to load older status changes.",
  );
  await click("Try again");
  assert.equal(requests[2].url.href, requests[1].url.href);
  await respond(2, { history: [entry("under_review")], nextCursor: "last" });
  assert.deepEqual(statuses(), ["Needs details", "Under review"]);
  assert.equal(
    window.document.activeElement,
    container.querySelector("li:last-child"),
  );
  await click("Load older changes");
  assert.equal(requests[3].url.searchParams.get("cursor"), "last");

  await render("second");
  assert.equal(requests[4].url.search, "?order=newest");
  assert.deepEqual(statuses(), []);
  await respond(4, { history: [entry("accepted")], nextCursor: null });
  await respond(3, { history: [entry("declined")], nextCursor: null });
  assert.deepEqual(statuses(), ["Accepted for processing"]);
  assert.equal(container.querySelector("button"), null);
});
