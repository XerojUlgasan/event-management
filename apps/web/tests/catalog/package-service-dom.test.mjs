import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Window } from "happy-dom";
import { createServer } from "vite";

const rootDir = fileURLToPath(new URL("../../", import.meta.url));

let window,
  server,
  cache,
  act,
  createElement,
  useState,
  createRoot,
  Terms,
  PackageEditor,
  CatalogEditor,
  Provider;
let root, container, requests, failReset;

const service = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "photo",
  name: "Photography",
  description: "Coverage",
  imageUrl: null,
  fixedPricePesos: 5000,
  includedHours: 4,
  hourlyRatePesos: 900,
  sections: [],
};

const second = {
  ...service,
  id: "66666666-6666-4666-8666-666666666666",
  name: "Music",
  slug: "music",
};

const widget = {
  id: "22222222-2222-4222-8222-222222222222",
  type: "service",
  x: 0,
  y: 0,
  w: 6,
  h: 5,
  markdown: "",
  media: null,
  alt: "",
  caption: "",
  autoplay: false,
  serviceId: service.id,
  service: {
    id: service.id,
    slug: service.slug,
    name: service.name,
    description: service.description,
    imageUrl: service.imageUrl,
  },
};

const packageItem = {
  id: "33333333-3333-4333-8333-333333333333",
  slug: "package",
  name: "Celebration",
  description: "",
  maxGuests: 100,
  price: { kind: "fixed", currency: "PHP", amountMinor: 1000000 },
  sections: [
    {
      id: "44444444-4444-4444-8444-444444444444",
      title: "",
      widgets: [widget],
    },
  ],
  addonServices: [],
  imageUrl: null,
  updatedAt: "2026-01-01",
  packageType: "custom",
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

before(async () => {
  window = new Window({ url: "http://localhost/" });

  for (const name of [
    "window",
    "document",
    "navigator",
    "HTMLElement",
    "HTMLInputElement",
    "HTMLTextAreaElement",
    "HTMLDialogElement",
    "Element",
    "Node",
    "MutationObserver",
    "Event",
    "MouseEvent",
    "KeyboardEvent",
    "getComputedStyle",
    "crypto",
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
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.fetch = async (url) => {
    requests.push(String(url));

    if (String(url).includes(`/admin/services/${service.id}`))
      return failReset ? json({ error: "unavailable" }, 500) : json(service);

    return json({ services: [service, second], nextCursor: null });
  };
  ({ act, createElement, useState } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  cache = await mkdtemp(join(tmpdir(), "clemora-package-dom-"));
  server = await createServer({
    root: rootDir,
    cacheDir: cache,
    configFile: false,
    appType: "custom",
    server: { middlewareMode: true },
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
  ({ ServiceTermsDialog: Terms } = await server.ssrLoadModule(
    "/src/components/catalog/ServiceTermsDialog.tsx",
  ));
  ({ PackageEditor } = await server.ssrLoadModule(
    "/src/components/catalog/PackageEditor.tsx",
  ));
  ({ CatalogEditor } = await server.ssrLoadModule(
    "/src/components/catalog/CatalogEditor.tsx",
  ));
  ({ NotificationProvider: Provider } = await server.ssrLoadModule(
    "/@fs" +
      fileURLToPath(
        new URL(
          "../../../../packages/ui/src/molecules/NotificationProvider.tsx",
          import.meta.url,
        ),
      ),
  ));
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());

  container?.remove();
  root = null;
  await window.happyDOM.abort();
});
after(async () => {
  await server?.close();

  if (cache) await rm(cache, { recursive: true, force: true });

  window?.close();
});

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

async function render(component, props) {
  requests = [];
  failReset = false;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(createElement(Provider, null, createElement(component, props))),
  );
  await flush();
}

function button(name) {
  const found = [...document.querySelectorAll("button")].find(
    (node) =>
      node.textContent.trim() === name ||
      ((["Photography", "Music"].includes(name)
        ? node.classList.contains("pe-reference-option")
        : ["Private package details", "Package details"].includes(name)) &&
        node.textContent.includes(name)) ||
      node.getAttribute("aria-label") === name,
  );

  assert.ok(
    found,
    `Missing button ${name}: ${document.body.textContent.slice(-1000)}`,
  );

  return found;
}

async function click(name) {
  await act(async () => button(name).click());
  await flush();
}

function input(label) {
  const labelNode = [...document.querySelectorAll("label")].find((node) =>
    node.textContent.includes(label),
  );

  assert.ok(labelNode, `Missing label ${label}`);

  return document.getElementById(labelNode.htmlFor);
}

async function change(label, value) {
  const node = input(label);
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    setter.call(node, value);
    node.dispatchEvent(new window.Event("input", { bubbles: true }));
    node.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
}

test("legacy included settings stay unspecified until saved; reset failure can retry and Escape restores focus", async () => {
  let saved;
  function Harness() {
    const [open, setOpen] = useState(false);

    return createElement(
      "div",
      null,
      createElement(
        "button",
        { onClick: () => setOpen(true) },
        "Open settings",
      ),
      open &&
        createElement(Terms, {
          serviceId: service.id,
          terms: { includedHours: null, hourlyRatePesos: null },
          onSave: (value) => {
            saved = value;
            setOpen(false);
          },
          onClose: () => setOpen(false),
        }),
    );
  }
  await render(Harness);
  button("Open settings").focus();
  await click("Open settings");
  assert.equal(input("Included hours").value, "");
  assert.equal(input("Excess hourly rate").value, "");
  assert.equal(requests.length, 0);
  failReset = true;
  await click("Reset to defaults");
  assert.match(document.body.textContent, /Could not load service defaults/);
  assert.equal(input("Included hours").value, "");
  failReset = false;
  await click("Reset to defaults");
  assert.equal(input("Included hours").value, "4");
  assert.equal(input("Excess hourly rate").value, "900");
  await change("Included hours", "0");
  await click("Save settings");
  assert.match(document.body.textContent, /positive whole numbers/);
  assert.equal(saved, undefined);
  await act(async () =>
    document
      .querySelector("dialog")
      .dispatchEvent(
        new window.Event("cancel", { bubbles: false, cancelable: true }),
      ),
  );
  await flush();
  assert.equal(document.activeElement, button("Open settings"));
});

test("private package details do not expose booking add-ons", async () => {
  await render(PackageEditor, {
    initial: packageItem,
    onClose: () => {},
    onSaved: () => {},
    saveCustom: async () => {},
  });
  await click("Private package details");
  assert.doesNotMatch(document.body.textContent, /Add-on services/);
  assert.equal(
    [...document.querySelectorAll("button")].some(
      (node) => node.textContent.trim() === "Add service",
    ),
    false,
  );
});

test("details modal dismisses on Escape and restores its opener", async () => {
  await render(PackageEditor, {
    initial: packageItem,
    onClose: () => {},
    onSaved: () => {},
    saveCustom: async () => {},
  });
  const opener = button("Private package details");
  opener.focus();
  await click("Private package details");

  const modal = [...document.querySelectorAll("dialog")].find((node) =>
    node.textContent.includes("Maximum guests"),
  );

  assert.ok(modal?.open);
  await act(async () =>
    modal.dispatchEvent(new window.Event("cancel", { cancelable: true })),
  );
  await flush();
  assert.equal(modal.isConnected, false);
  assert.equal(document.activeElement, opener);
});

test("thumbnail Escape does not dismiss the details modal", async () => {
  await render(PackageEditor, {
    initial: { ...packageItem, imageUrl: "https://example.test/thumbnail.png" },
    onClose: () => {},
    onSaved: () => {},
    saveCustom: async () => {},
  });
  await click("Private package details");
  await click("View thumbnail full size");
  const lightbox = document.querySelector(
    'dialog[aria-label="Thumbnail preview"]',
  );
  const details = lightbox.closest("dialog.modal-backdrop");
  assert.ok(lightbox.open && details.open);
  const event = new window.Event("cancel", { cancelable: true });
  await act(async () => lightbox.dispatchEvent(event));
  assert.equal(event.defaultPrevented, false);
  assert.ok(details.isConnected && details.open);
});

test("blank editor name keeps the editor open and focuses its name field", async () => {
  await render(PackageEditor, {
    initial: { ...packageItem, name: "" },
    onClose: () => {},
    onSaved: () => {},
    saveCustom: async () => {},
  });
  await click("Save private package");
  assert.match(document.body.textContent, /Enter a package name/);
  assert.equal(
    document.activeElement.getAttribute("aria-label"),
    "Private package name",
  );
  assert.equal(document.querySelector("dialog.modal-backdrop"), null);
});

test("service canvas validation returns to the editor rather than details", async () => {
  await render(CatalogEditor, {
    initial: { name: "Service", sections: [] },
    entity: "service",
    onClose: () => {},
    onSaved: () => {},
    onSave: async () => {},
    validate: () => undefined,
    validateCanvas: () => "Add a service image before saving.",
    renderDetails: () => "Details content",
    renderPreview: () => "Preview content",
  });
  await click("Preview");
  await click("Save changes");
  assert.match(document.body.textContent, /Add a service image before saving/);
  assert.equal(document.querySelector("dialog.modal-backdrop"), null);
  assert.ok(button("Preview"));
});

test("catalog editor does not show private add-on controls", async () => {
  await render(PackageEditor, {
    initial: packageItem,
    onClose: () => {},
    onSaved: () => {},
  });
  await click("Package details");
  assert.doesNotMatch(document.body.textContent, /Add-on services/);
});

test("private editor keeps changes after a failed save and can retry", async () => {
  let attempts = 0;
  let saved;
  await render(PackageEditor, {
    initial: packageItem,
    onClose: () => {},
    onSaved: () => {},
    saveCustom: async (content) => {
      attempts++;

      if (attempts === 1) throw new Error("Synthetic save failure");

      saved = structuredClone(content);
    },
  });
  await click("Included service settings");
  await change("Included hours", "6");
  await click("Save settings");
  await click("Save private package");
  assert.match(document.body.textContent, /Synthetic save failure/);
  assert.equal(saved, undefined);
  await click("Save private package");
  assert.equal(saved.sections[0].widgets[0].serviceTerms.includedHours, 6);
});
