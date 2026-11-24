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
let uploadThumbnail;

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

    if (String(url).endsWith("/admin/catalog-media") && uploadThumbnail)
      return uploadThumbnail();

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
    define: { "import.meta.env.PUBLIC_API_URL": JSON.stringify("/v1") },
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
  uploadThumbnail = undefined;
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

async function chooseThumbnail(file) {
  const input = document.querySelector(
    'input[aria-label="Choose card thumbnail"]',
  );
  assert.ok(input);
  Object.defineProperty(input, "files", {
    configurable: true,
    value: file ? [file] : [],
  });
  await act(async () =>
    input.dispatchEvent(new window.Event("change", { bubbles: true })),
  );
  await flush();
}

test("private thumbnail replacement keeps the old image through cancellation and failure, then saves the new ID", async () => {
  const original = "https://example.test/original.png";
  const replacement = "https://example.test/replacement.png";
  const mediaId = "55555555-5555-4555-8555-555555555555";
  const imageUrl = () =>
    document
      .querySelector(".thumbnail-field [data-catalog-thumbnail-image]")
      ?.getAttribute("src");
  const saves = [];
  await render(PackageEditor, {
    initial: { ...packageItem, imageUrl: original },
    onClose: () => {},
    onSaved: () => {},
    saveCustom: async (_, id) => {
      saves.push(id);
    },
  });
  await click("Private package details");
  let pickerOpens = 0;
  document
    .querySelector('input[aria-label="Choose card thumbnail"]')
    .addEventListener("click", () => pickerOpens++);
  await click("Change image");
  await chooseThumbnail();
  assert.equal(pickerOpens, 1);
  assert.equal(imageUrl(), original);
  await chooseThumbnail(new File(["data"], "file.gif", { type: "image/gif" }));
  assert.match(
    document.querySelector(".thumbnail-field [role=alert]").textContent,
    /Choose a JPEG/,
  );

  const file = new File(["data"], "photo.png", { type: "image/png" });
  uploadThumbnail = () => json({ error: "Unavailable" }, 502);
  await chooseThumbnail(file);
  assert.equal(imageUrl(), original);
  assert.match(
    document.querySelector(".thumbnail-field [role=alert]").textContent,
    /upload failed/,
  );

  let completeUpload;
  uploadThumbnail = () =>
    new Promise((resolve) => {
      completeUpload = resolve;
    });
  await chooseThumbnail(file);
  assert.equal(imageUrl(), original);
  assert.equal(button("Use default").disabled, true);
  await click("Done");
  assert.equal(button("Save private package").disabled, true);
  await act(async () =>
    completeUpload(json({ id: mediaId, url: replacement })),
  );
  await click("Private package details");
  assert.equal(imageUrl(), replacement);
  assert.equal(document.querySelector(".thumbnail-field [role=alert]"), null);
  await click("Done");
  assert.deepEqual(saves, []);
  await click("Save private package");
  assert.deepEqual(saves, [mediaId]);
});

test("unavailable private thumbnail displays branded artwork and resets with an explicit null", async () => {
  const saves = [];
  await render(PackageEditor, {
    initial: { ...packageItem, imageUrl: "https://example.test/missing.png" },
    onClose: () => {},
    onSaved: () => {},
    saveCustom: async (_, id) => {
      saves.push(id);
    },
  });
  await click("Private package details");
  const field = document.querySelector(".thumbnail-field");
  const image = field.querySelector("[data-catalog-thumbnail-image]");
  await act(async () => image.dispatchEvent(new window.Event("error")));
  assert.match(field.textContent, /Image unavailable/);
  assert.ok(field.querySelector(".ui-catalog-thumbnail-brand"));
  assert.equal(field.querySelector("[data-catalog-thumbnail-image]"), null);
  assert.ok(button("Change image"));
  await click("Use default");
  assert.match(field.textContent, /AMAC default image/);
  assert.equal(document.activeElement, button("Add image"));
  await click("Done");
  await click("Save private package");
  assert.deepEqual(saves, [null]);
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

test("catalog editor keyboard resize stops at three columns and two rows", async (t) => {
  t.mock.getter(window.HTMLElement.prototype, "clientWidth", () => 950);
  t.mock.getter(window.HTMLElement.prototype, "offsetWidth", () => 950);

  let saved;
  await render(PackageEditor, {
    initial: packageItem,
    onClose: () => {},
    onSaved: () => {},
    saveCustom: async (content) => {
      saved = content;
    },
  });

  const handle = document.querySelector(".pe-widget-move");
  assert.ok(handle);

  // The legacy 12-column section opens with a 12×5 widget on the 24-column grid.
  for (const key of [
    ...Array(10).fill("ArrowLeft"),
    ...Array(4).fill("ArrowUp"),
  ]) {
    await act(async () =>
      handle.dispatchEvent(
        new window.KeyboardEvent("keydown", {
          key,
          shiftKey: true,
          bubbles: true,
        }),
      ),
    );
  }

  await click("Save private package");
  const { w, h } = saved.sections[0].widgets[0];
  assert.deepEqual({ w, h }, { w: 3, h: 2 });
});

test("catalog editor can move and save a legacy widget below the resize minimum", async (t) => {
  t.mock.getter(window.HTMLElement.prototype, "clientWidth", () => 950);
  t.mock.getter(window.HTMLElement.prototype, "offsetWidth", () => 950);

  let saved;
  await render(PackageEditor, {
    initial: {
      ...packageItem,
      sections: [
        {
          ...packageItem.sections[0],
          widgets: [{ ...widget, x: 1, w: 1, h: 1 }],
        },
      ],
    },
    onClose: () => {},
    onSaved: () => {},
    saveCustom: async (content) => {
      saved = content;
    },
  });

  const handle = document.querySelector(".pe-widget-move");
  assert.ok(handle);
  await act(async () =>
    handle.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    ),
  );

  await click("Save private package");
  const { x, w, h } = saved.sections[0].widgets[0];
  assert.deepEqual({ x, w, h }, { x: 3, w: 2, h: 1 });
});

test("the private package palette adds widgets without a section dropdown", async () => {
  await render(PackageEditor, {
    initial: {
      ...packageItem,
      sections: [
        ...packageItem.sections,
        {
          id: "77777777-7777-4777-8777-777777777777",
          title: "Second section",
          widgets: [],
        },
      ],
    },
    onClose: () => {},
    onSaved: () => {},
    saveCustom: async () => {},
  });

  const sections = () => [...document.querySelectorAll(".pe-editor-section")];

  assert.equal(sections().length, 2);
  assert.doesNotMatch(document.body.textContent, /Add to section/);

  await click("Add Markdown");
  assert.deepEqual(
    sections().map((section) => section.querySelectorAll(".pe-widget").length),
    [2, 0],
  );

  await click("+ Add section");
  await click("Add Markdown");
  assert.deepEqual(
    sections().map((section) => section.querySelectorAll(".pe-widget").length),
    [2, 0, 1],
  );
});

test("Markdown widgets edit in place, render on blur, and save the source", async () => {
  let saved;
  await render(PackageEditor, {
    initial: packageItem,
    onClose: () => {},
    onSaved: () => {},
    saveCustom: async (content) => {
      saved = structuredClone(content);
    },
  });
  await click("Add Markdown");
  const widgetBody = button("Edit Markdown widget").closest(".pe-widget-body");
  assert.equal(widgetBody.querySelector("h2")?.textContent, "Your heading");

  await click("Edit Markdown widget");
  const source = widgetBody.querySelector(
    'textarea[aria-label="Markdown content"]',
  );
  const markdown =
    "## New heading\n\nSome **bold text**.\nSingle Enter line\n\nNew paragraph\n\nExplicit break one  \nExplicit break two.";
  assert.equal(document.activeElement, source);
  assert.match(source.value, /^## Your heading/);
  assert.equal(widgetBody.querySelector("h2"), null);
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    ).set;
    setter.call(source, markdown);
    source.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  const name = document.querySelector('[aria-label="Private package name"]');
  await act(async () => name.focus());
  assert.equal(document.activeElement, name);
  assert.equal(widgetBody.querySelector("textarea"), null);
  assert.equal(widgetBody.querySelector("h2")?.textContent, "New heading");
  assert.equal(widgetBody.querySelector("strong")?.textContent, "bold text");
  assert.equal(widgetBody.querySelectorAll(".wmde-markdown p").length, 3);
  assert.equal(widgetBody.querySelectorAll(".wmde-markdown br").length, 2);

  await click("Edit Markdown");
  const reopened = widgetBody.querySelector("textarea");
  assert.equal(reopened.value, markdown);
  const escape = new window.KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
  });
  await act(async () => reopened.dispatchEvent(escape));
  assert.ok(escape.defaultPrevented);
  assert.equal(document.activeElement, button("Edit Markdown widget"));

  await click("Undo");
  assert.equal(widgetBody.querySelector("h2")?.textContent, "Your heading");
  await click("Redo");
  await click("Save private package");
  assert.equal(saved.sections[0].widgets[1].markdown, markdown);
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
  assert.equal(saved.sections[0].columns, 24);
  assert.equal(saved.sections[0].widgets[0].w, 12);
  assert.equal(saved.sections[0].widgets[0].serviceTerms.includedHours, 6);
});

test("conversation booking keeps the chosen package when a new search hides it", async (t) => {
  const { ConversationBooking } = await server.ssrLoadModule(
    "/src/components/booking-requests/ConversationBooking.tsx",
  );
  const queries = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    const path = new URL(url);

    if (path.pathname.endsWith("/me")) return json({ role: "customer" });

    assert.ok(path.pathname.endsWith("/packages"));
    const search = path.searchParams.get("search");
    queries.push(search);

    return json({ packages: search ? [] : [packageItem], nextCursor: null });
  });
  await render(ConversationBooking, {
    conversationId: "test-thread",
    onSubmitted: () => assert.fail("Continue must only open the booking form"),
    onClose() {},
  });
  const choices = document.querySelectorAll("button[aria-pressed]");
  assert.equal(choices[0].getAttribute("aria-pressed"), "true");
  assert.ok(choices[1].textContent.includes(packageItem.name));
  await act(async () => choices[1].click());
  await change("Search packages", "no match");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
  assert.deepEqual(queries, [null, "no match"]);
  assert.ok(
    document.body.textContent.includes("No packages match your search."),
  );
  await click("Continue");
  assert.ok(
    document
      .querySelector(".booking-intro")
      .textContent.includes(packageItem.name),
  );
});
