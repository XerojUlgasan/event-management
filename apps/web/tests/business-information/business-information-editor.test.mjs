import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Window } from "happy-dom";
import { createServer } from "vite";

const webRoot = fileURLToPath(new URL("../../", import.meta.url));

const initialUpdatedAt = "2026-01-01T10:00:00.000Z";
const latestUpdatedAt = "2026-01-01T11:00:00.000Z";

let server;
let cacheDir;
let window;
let act;
let createElement;
let createRoot;
let NotificationProvider;
let BusinessInformationPage;
let AdminShell;
let useWorkspaceLocation;
let adminKey;
let emptyBusinessInformation;
let root;
let container;
let requests;
let scenario;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

function businessResponse(information, updatedAt) {
  return { information, updatedAt };
}

const VISIBLE_FIELD_LABELS = [
  "Business name",
  "Short introduction",
  "Phone",
  "Email",
  "Facebook",
  "Instagram",
  "Address",
  "Map link",
  "Service areas",
  "Opening hours",
];

function initialInformation() {
  const empty = emptyBusinessInformation();

  return {
    ...empty,
    contact: {
      ...empty.contact,
      email: "team@example.com",
    },
    policies: {
      ...empty.policies,
      cancellation: "Kept off-form policy value",
    },
  };
}

before(async () => {
  window = new Window();

  for (const name of [
    "window",
    "document",
    "navigator",
    "HTMLElement",
    "HTMLInputElement",
    "HTMLTextAreaElement",
    "HTMLFormElement",
    "HTMLDialogElement",
    "Element",
    "Node",
    "MutationObserver",
    "Event",
    "getComputedStyle",
    "confirm",
  ])
    Object.defineProperty(globalThis, name, {
      value: window[name],
      configurable: true,
      writable: true,
    });

  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  globalThis.MutationObserver =
    window.MutationObserver ??
    class {
      observe() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    };
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  scenario = {
    updatedAt: initialUpdatedAt,
    information: null,
    conflictOnSave: false,
    failSave: false,
    failLoad: false,
  };

  globalThis.fetch = async (url, options = {}) => {
    const { pathname } = new URL(url, "http://localhost:3000");
    const method = options.method ?? "GET";
    requests.push({ pathname, method, body: options.body });

    if (pathname.endsWith("/notifications"))
      return json({ notifications: [], unreadCount: 0, nextCursor: null });

    if (
      pathname === "/v1/admin/business-information" ||
      pathname.endsWith("/admin/business-information")
    ) {
      if (method === "GET") {
        if (scenario.failLoad) return json({ error: "unavailable" }, 503);

        return json(businessResponse(scenario.information, scenario.updatedAt));
      }

      if (method === "PUT") {
        if (scenario.conflictOnSave) return json({ error: "Conflict" }, 409);

        if (scenario.failSave) return json({ error: "Server error" }, 500);

        const body = JSON.parse(options.body);
        scenario.information = body.information;
        scenario.updatedAt = latestUpdatedAt;

        return json(businessResponse(scenario.information, scenario.updatedAt));
      }
    }

    return json({ error: "not found" }, 404);
  };

  ({ act, createElement } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));

  cacheDir = await mkdtemp(join(tmpdir(), "clemora-bi-editor-"));
  server = await createServer({
    root: webRoot,
    cacheDir,
    configFile: false,
    define: { "import.meta.env.PUBLIC_API_URL": JSON.stringify("/v1") },
    appType: "custom",
    server: { middlewareMode: true },
    esbuild: { jsx: "automatic" },
    plugins: [
      {
        name: "css-stub",
        enforce: "pre",
        resolveId(id) {
          if (id.endsWith(".css")) return id;
        },
        load(id) {
          if (id.endsWith(".css")) return "export default {}";
        },
      },
    ],
    resolve: {
      noExternal: ["@uiw/react-markdown-preview"],
      external: ["@babel/runtime"],
    },
    ssr: {
      noExternal: [
        "@event-management/ui",
        "@uiw/react-markdown-preview",
        "@uiw/react-md-editor",
      ],
    },
    logLevel: "silent",
  });

  ({ BusinessInformationPage } = await server.ssrLoadModule(
    "/src/components/workspaces/admin/business-information/BusinessInformationPage.tsx",
  ));
  ({ AdminShell } = await server.ssrLoadModule(
    "/src/components/workspaces/admin/AdminShell.tsx",
  ));
  ({ useWorkspaceLocation } = await server.ssrLoadModule(
    "/src/lib/navigation/workspace-navigation.ts",
  ));
  ({ adminKey } = await server.ssrLoadModule("/src/components/app/routes.ts"));
  ({ emptyBusinessInformation } = await server.ssrLoadModule(
    "/@fs" +
      fileURLToPath(
        new URL(
          "../../../../packages/contracts/src/business-information.ts",
          import.meta.url,
        ),
      ),
  ));
  ({ NotificationProvider } = await server.ssrLoadModule(
    "/@fs" +
      fileURLToPath(
        new URL(
          "../../../../packages/ui/src/molecules/NotificationProvider.tsx",
          import.meta.url,
        ),
      ),
  ));
  scenario.information = structuredClone(initialInformation());
});

afterEach(async () => {
  if (root) await act(async () => root.unmount());

  container?.remove();
  root = null;
  requests = [];
  scenario.updatedAt = initialUpdatedAt;
  scenario.information = structuredClone(initialInformation());
  scenario.conflictOnSave = false;
  scenario.failSave = false;
  scenario.failLoad = false;
  await window.happyDOM.abort();
});

after(async () => {
  await server?.close();

  if (cacheDir) await rm(cacheDir, { recursive: true, force: true });

  window?.close();
});

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

async function changeEmail(value) {
  const node = emailInput();
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    setter.call(node, value);
    node.dispatchEvent(new window.Event("input", { bubbles: true }));
    node.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
  await flush();
}

async function renderPage() {
  requests = [];
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      createElement(
        NotificationProvider,
        null,
        createElement(BusinessInformationPage),
      ),
    ),
  );
  await flush();
  await flush();
}

function emailInput() {
  const emailFields = [...document.querySelectorAll('input[type="email"]')];
  assert.equal(emailFields.length, 1);

  return emailFields[0];
}

async function clickSave() {
  const save = [...document.querySelectorAll("button")].find((node) =>
    node.textContent.includes("Save business information"),
  );

  assert.ok(save, "Save button missing");
  await act(async () => save.click());
  await flush();
  await flush();
}

function WorkspaceHarness() {
  const { path } = useWorkspaceLocation("/app/business-information");

  return createElement(AdminShell, {
    profile: {
      id: "admin-test",
      displayName: "Admin",
      email: "admin@example.test",
    },
    active: adminKey(path),
    search: "",
    onSignOut() {},
  });
}

test("workspace sidebar and Back retain the unsaved business-information form", async () => {
  window.happyDOM.setURL("http://localhost/app/business-information");
  window.history.replaceState(null, "", "/app/business-information");
  requests = [];
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      createElement(
        NotificationProvider,
        null,
        createElement(WorkspaceHarness),
      ),
    ),
  );
  await flush();
  await flush();
  await changeEmail("unsaved@example.test");

  const input = emailInput();

  const overview = [...document.querySelectorAll(".side-nav button")].find(
    (button) => button.textContent === "Overview",
  );

  assert.ok(overview);
  await act(async () => overview.click());
  await flush();
  assert.equal(window.location.pathname, "/app/overview");
  assert.ok(input.closest("[hidden]"), "Inactive form is hidden");

  await act(async () => window.history.back());
  await flush();
  assert.equal(window.location.pathname, "/app/business-information");
  assert.equal(emailInput(), input, "Back reuses the same form");
  assert.equal(emailInput().value, "unsaved@example.test");
  assert.equal(input.closest("[hidden]"), null);
  assert.equal(
    requests.filter(
      (request) =>
        request.pathname.endsWith("/business-information") &&
        request.method === "GET",
    ).length,
    1,
  );
  assert.equal(
    requests.filter((request) => request.method === "PUT").length,
    0,
  );
});

test("a missing profile opens an editable blank form and the first save clears its empty state", async () => {
  scenario.updatedAt = null;
  scenario.information = emptyBusinessInformation();
  await renderPage();

  assert.match(document.body.textContent, /no business information saved yet/i);
  assert.equal(emailInput().value, "");
  await changeEmail("first@example.test");
  await clickSave();

  const save = requests.find((request) => request.method === "PUT");

  const body = JSON.parse(save.body);
  assert.equal(body.expectedUpdatedAt, null);
  assert.equal(body.information.contact.email, "first@example.test");
  assert.doesNotMatch(
    document.body.textContent,
    /no business information saved yet/i,
  );
  assert.equal(emailInput().value, "first@example.test");
});

test("editor loads, sends expected save payload, and retains values after save failure", async () => {
  await renderPage();

  const input = emailInput();
  assert.equal(input.value, "team@example.com");

  await changeEmail("edited@example.com");

  scenario.failSave = true;
  await clickSave();

  assert.equal(emailInput().value, "edited@example.com");
  assert.ok(
    document.querySelector(".form-error"),
    "Expected inline form error after failed save",
  );

  const savePut = requests.find((entry) => entry.method === "PUT");

  assert.ok(savePut, "Expected PUT save");
  const body = JSON.parse(savePut.body);
  assert.equal(body.expectedUpdatedAt, initialUpdatedAt);
  assert.equal(body.information.contact.email, "edited@example.com");
});

test("409 conflict keeps edits, blocks save, and reload latest replaces form after confirmation", async () => {
  await renderPage();

  await changeEmail("stale@example.com");

  scenario.conflictOnSave = true;
  await clickSave();

  assert.equal(emailInput().value, "stale@example.com");
  assert.match(
    document.body.textContent,
    /out of date|newer business information/i,
  );

  const save = [...document.querySelectorAll("button")].find((node) =>
    node.textContent.includes("Save business information"),
  );

  assert.equal(save?.disabled, true);

  scenario.conflictOnSave = false;
  const base = initialInformation();
  scenario.information = {
    ...structuredClone(base),
    contact: {
      ...base.contact,
      email: "server@example.com",
    },
  };
  scenario.updatedAt = latestUpdatedAt;

  const originalConfirm = window.confirm;
  window.confirm = () => true;

  try {
    const reload = [...document.querySelectorAll("button")].find((node) =>
      node.textContent.includes("Reload latest"),
    );

    assert.ok(reload, "Reload latest button missing");
    await act(async () => reload.click());
    await flush();
    await flush();
  } finally {
    window.confirm = originalConfirm;
  }

  assert.equal(emailInput().value, "server@example.com");
  assert.doesNotMatch(document.body.textContent, /out of date/i);
  assert.equal(save?.disabled, false);
});

test("editor shows only the simplified field set with no FAQ or link repeaters", async () => {
  await renderPage();

  const footerLink = document.querySelector('a[href="/#business-information"]');

  assert.equal(footerLink?.textContent.trim(), "View website footer");
  assert.equal(document.querySelector('a[href="/about"]'), null);
  assert.match(
    document.body.textContent,
    /Saved details appear in the website footer/,
  );

  for (const label of VISIBLE_FIELD_LABELS) {
    assert.ok(
      document.body.textContent.includes(label),
      `Expected label: ${label}`,
    );
  }

  assert.equal(
    document.querySelectorAll(".business-information-collection").length,
    0,
  );
  assert.doesNotMatch(
    document.body.textContent,
    /Add FAQ|Add link|Other links/i,
  );
  assert.equal(
    document.querySelectorAll("section.business-information-section").length,
    4,
  );
  assert.deepEqual(
    [
      ...document.querySelectorAll(
        ".business-information-form .ui-field > span",
      ),
    ].map((node) => node.textContent),
    VISIBLE_FIELD_LABELS,
  );
});

test("successful save sends the full information payload including hidden fields", async () => {
  const expected = structuredClone(scenario.information);
  expected.contact.email = "saved@example.com";

  await renderPage();

  await changeEmail("saved@example.com");

  scenario.failSave = false;
  await clickSave();

  const savePut = requests.find((entry) => entry.method === "PUT");

  assert.ok(savePut, "Expected PUT save");
  const body = JSON.parse(savePut.body);
  assert.deepEqual(body.information, expected);
  assert.equal(
    body.information.policies.cancellation,
    "Kept off-form policy value",
  );
  assert.equal(
    scenario.information.policies.cancellation,
    "Kept off-form policy value",
  );
  await act(async () => root.unmount());
  container.remove();
  root = null;
  await renderPage();
  assert.equal(emailInput().value, "saved@example.com");
  assert.deepEqual(scenario.information, expected);
});

test("load failure shows retry and recovers on try again", async () => {
  scenario.failLoad = true;
  await renderPage();

  assert.match(
    document.body.textContent,
    /Could not load business information/i,
  );
  assert.equal(document.querySelector("form.business-information-form"), null);

  scenario.failLoad = false;

  const retry = [...document.querySelectorAll("button")].find((node) =>
    node.textContent.includes("Try again"),
  );

  assert.ok(retry, "Try again button missing");
  await act(async () => retry.click());
  await flush();
  await flush();

  assert.ok(document.querySelector("form.business-information-form"));
  assert.equal(emailInput().value, "team@example.com");
});

test("save blocks the form while a save request is in flight", async () => {
  let releasePut;

  const gate = new Promise((resolve) => {
    releasePut = resolve;
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const { pathname } = new URL(url, "http://localhost:3000");
    const method = options.method ?? "GET";

    if (
      method === "PUT" &&
      (pathname === "/v1/admin/business-information" ||
        pathname.endsWith("/admin/business-information"))
    ) {
      requests.push({ pathname, method, body: options.body });
      await gate;
      const body = JSON.parse(options.body);
      scenario.information = body.information;
      scenario.updatedAt = latestUpdatedAt;

      return json(businessResponse(scenario.information, scenario.updatedAt));
    }

    return originalFetch(url, options);
  };

  try {
    await renderPage();
    await changeEmail("pending@example.com");

    const save = [...document.querySelectorAll("button")].find((node) =>
      node.textContent.includes("Save business information"),
    );

    const fieldset = document.querySelector(
      "fieldset.business-information-sections",
    );
    assert.ok(fieldset, "Expected form fieldset");

    assert.ok(save, "Save button missing");
    await act(async () => save.click());

    assert.equal(save?.disabled, true);
    assert.equal(fieldset.disabled, true);

    await act(async () => releasePut());
    await flush();
    await flush();
  } finally {
    releasePut();
    globalThis.fetch = originalFetch;
  }
});
