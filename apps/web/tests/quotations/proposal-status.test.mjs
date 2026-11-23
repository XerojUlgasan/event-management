import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Window } from "happy-dom";
import { createServer } from "vite";

const webRoot = fileURLToPath(new URL("../../", import.meta.url));

let server,
  cacheDir,
  window,
  createElement,
  act,
  createRoot,
  NotificationProvider,
  Quotations,
  BookingPackage,
  CalendarPage,
  BookingRequestPage,
  BookingOfferAddons;
let root, container, requests, scenario;

const openStatuses = ["under_review", "needs_details", "accepted"];

const closedStatuses = ["declined", "cancelled"];

const time = "2026-11-19T00:00:00.000Z";
const laterRevision = "2026-11-19T01:00:00.000Z";

const item = {
  id: "item-1",
  direction: "add",
  kind: "addition",
  description: "Flowers",
  amountMinor: 5000,
  serviceId: null,
};

const quotation = (status = "sent") => ({
  id: "quote-1",
  bookingRequestId: "booking-1",
  version: 1,
  currency: "PHP",
  baseAmountMinor: 100000,
  totalAmountMinor: 105000,
  status,
  createdBy: "admin",
  createdAt: time,
  updatedAt: time,
  sentAt: status === "sent" ? time : null,
  supersededAt: null,
  offeredPackageId: "package-1",
  adjustmentsReviewed: true,
  previousQuotationId: null,
  revisionReason: null,
  items: [item],
});

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

function fakeFetch(url, options = {}) {
  const path = new URL(url).pathname;
  const method = options.method ?? "GET";
  requests.push({ path, method, body: options.body });

  if (scenario.intercept) {
    const result = scenario.intercept(path, method, options);

    if (result) return result;
  }

  if (method !== "GET") {
    if (scenario.conflict)
      return Promise.resolve(json({ error: "Request changed" }, 409));

    const body = JSON.parse(options.body);

    if (path.endsWith("/quotations/send")) {
      const previous = scenario.quote;

      const delivered = {
        ...quotation(),
        id: "sent-" + (previous?.version ?? 0),
        version: (previous?.version ?? 0) + 1,
        previousQuotationId: previous?.id ?? null,
        revisionReason: body.revisionReason,
        baseAmountMinor: scenario.baseAmountMinor ?? 100000,
        items: body.items.map((line) => {
          if (!line.addon) return line;

          const addon = scenario.addons.find((item) => item.id === line.id);

          return {
            ...addon,
            addon: { ...addon.addon, hours: line.addon.hours },
          };
        }),
      };

      scenario.quote = delivered;

      if (previous) {
        scenario.history = [
          { ...previous, status: "superseded", supersededAt: time },
          ...(scenario.history ?? []),
        ];
      }

      return Promise.resolve(json({ quotation: delivered }));
    }

    if (path.includes("/custom-package/addons/")) {
      const addonId = path.split("/").at(-1);
      scenario.packageUpdatedAt = laterRevision;
      scenario.bookingUpdatedAt = laterRevision;
      let addonServices = [];

      if (method === "DELETE") {
        scenario.addons = scenario.addons.filter((line) => line.id !== addonId);
      } else {
        const updated = scenario.addons.find((line) => line.id === addonId);

        updated.addon.source = {
          ...updated.addon.source,
          fixedPriceMinor:
            body.fixedPricePesos === null ? null : body.fixedPricePesos * 100,
          includedHours: body.includedHours,
          hourlyRateMinor: body.hourlyRatePesos * 100,
        };
        addonServices = [
          {
            id: scenario.uppercaseId ? updated.id.toUpperCase() : updated.id,
            serviceId: updated.serviceId,
            fixedPricePesos: body.fixedPricePesos,
            includedHours: body.includedHours,
            hourlyRatePesos: body.hourlyRatePesos,
            service: { name: updated.description },
          },
        ];
      }

      return Promise.resolve(
        json({
          package: {
            id: "package-1",
            updatedAt: scenario.packageUpdatedAt,
            price: { amountMinor: scenario.baseAmountMinor ?? 100000 },
            addonServices,
          },
          bookingRequest: { updatedAt: scenario.bookingUpdatedAt },
        }),
      );
    }

    return Promise.resolve(json({ bookingRequest: { updatedAt: time } }));
  }

  if (path.endsWith("/quotations/prepare")) {
    const currentOffer = scenario.quote?.sentAt ? scenario.quote : null;

    return Promise.resolve(
      json({
        preparation: {
          bookingRequestId: path.split("/").at(-3),
          packageId: "package-1",
          expectedBookingUpdatedAt: scenario.bookingUpdatedAt ?? time,
          expectedPackageUpdatedAt: scenario.packageUpdatedAt ?? time,
          currentOffer: currentOffer
            ? { id: currentOffer.id, updatedAt: currentOffer.updatedAt }
            : null,
          baseAmountMinor: scenario.baseAmountMinor ?? 100000,
          items: [
            ...(scenario.addons ?? []),
            ...(currentOffer?.items ?? []).filter((line) => !line.addon),
          ],
        },
      }),
    );
  }

  if (path.endsWith("/quotations")) {
    const q = scenario.quote;
    const rows = [...(q?.sentAt ? [q] : []), ...(scenario.history ?? [])];
    const exact = new URL(url).searchParams.get("quotationId");

    return Promise.resolve(
      json({
        quotations: exact ? rows.filter((line) => line.id === exact) : rows,
        currentOffer: q?.sentAt ? q : null,
        nextCursor: null,
      }),
    );
  }

  if (path === "/v1/quotations/quote-1")
    return Promise.resolve(json({ quotation: scenario.quote }));

  if (path.endsWith("/package-history"))
    return Promise.resolve(
      json({ history: scenario.packageHistory ?? [], nextCursor: null }),
    );

  if (path.endsWith("/package"))
    return Promise.resolve(
      json({ package: scenario.package ?? null, bookingUpdatedAt: time }),
    );

  if (path.endsWith("/admin/services"))
    return Promise.resolve(json({ services: [], nextCursor: null }));

  if (path.endsWith("/packages"))
    return Promise.resolve(
      json({
        packages: [
          { id: "catalog-1", name: "Catalog package", updatedAt: time },
        ],
        nextCursor: null,
      }),
    );

  if (path === "/v1/admin/event-days")
    return Promise.resolve(json({ eventDays: [] }));

  if (path.includes("/admin/booking-requests/"))
    return Promise.resolve(
      json({
        bookingRequest: {
          id: path.split("/").at(-1),
          status: scenario.bookingStatus ?? "under_review",
          requestedServices: scenario.requestedServices ?? [],
          updatedAt: scenario.bookingUpdatedAt ?? time,
        },
      }),
    );

  throw new Error(`Unexpected request: ${method} ${path}`);
}

before(async () => {
  window = new Window({ url: "http://localhost/" });

  for (const name of [
    "window",
    "document",
    "navigator",
    "HTMLElement",
    "HTMLDialogElement",
    "Element",
    "Node",
    "MutationObserver",
    "Event",
    "MouseEvent",
    "KeyboardEvent",
    "getComputedStyle",
  ]) {
    Object.defineProperty(globalThis, name, {
      value: window[name],
      configurable: true,
      writable: true,
    });
  }

  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.fetch = fakeFetch;
  ({ createElement, act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  cacheDir = await mkdtemp(join(tmpdir(), "clemora-proposal-ui-"));
  server = await createServer({
    root: webRoot,
    cacheDir,
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
  ({ Quotations } = await server.ssrLoadModule(
    "/src/components/quotations/Quotations.tsx",
  ));
  ({ BookingOfferAddons } = await server.ssrLoadModule(
    "/src/components/booking-requests/BookingOfferAddons.tsx",
  ));
  ({ BookingPackage } = await server.ssrLoadModule(
    "/src/components/booking-requests/BookingPackage.tsx",
  ));
  ({ CalendarPage } = await server.ssrLoadModule(
    "/src/components/workspaces/admin/calendar/CalendarPage.tsx",
  ));
  ({ BookingRequestPage } = await server.ssrLoadModule(
    "/src/components/workspaces/admin/booking-requests/BookingRequestPage.tsx",
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
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());

  container?.remove();
  root = null;
  await window.happyDOM.abort();
});
after(async () => {
  await server?.close();

  if (cacheDir) await rm(cacheDir, { recursive: true, force: true });

  window?.close();
});

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function render(Component, props, reset = true) {
  if (reset) {
    requests = [];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  }

  await act(async () => {
    root.render(
      createElement(
        NotificationProvider,
        null,
        createElement(Component, props),
      ),
    );
  });
  await flush();
}

function button(label) {
  const dialog = document.querySelector("dialog[open]");

  return [...(dialog ?? container).querySelectorAll("button")].find(
    (element) =>
      element.getAttribute("aria-label") === label ||
      element.textContent.trim() === label,
  );
}

async function click(label) {
  const target = button(label);
  assert.ok(target, `Missing button: ${label}`);
  assert.equal(target.disabled, false, `Disabled button: ${label}`);
  await act(async () => {
    target.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  });
  await flush();
}

function writes() {
  return requests.filter((request) => request.method !== "GET");
}

test("package history shows names and falls back without exposing actor IDs", async () => {
  const after = {
    name: "Package",
    maxGuests: 50,
    price: { amountMinor: 10000 },
    sections: [],
    addonServices: [],
  };
  scenario = {
    packageHistory: [
      {
        id: "one",
        actorId: "private-actor-one",
        actorName: "Ada Santos",
        action: "booking.custom_package_created",
        before: null,
        after,
        createdAt: time,
      },
      {
        id: "two",
        actorId: "private-actor-two",
        actorName: "  ",
        action: "booking.custom_package_updated",
        before: null,
        after,
        createdAt: time,
      },
      {
        id: "three",
        actorId: "private-actor-three",
        action: "booking.custom_package_updated",
        before: null,
        after,
        createdAt: time,
      },
    ],
  };
  await render(BookingPackage, { id: "booking-1", admin: true });
  assert.match(container.textContent, /Ada Santos/);
  assert.equal(
    (container.textContent.match(/Unknown administrator/g) ?? []).length,
    2,
  );
  assert.doesNotMatch(container.textContent, /private-actor/);
});

test("calendar drawer uses the example event name", async () => {
  scenario = {};
  await render(CalendarPage, {});
  await click("Tasting · Mendoza");
  assert.match(document.body.textContent, /Related eventMendoza–Reyes Wedding/);
  assert.doesNotMatch(document.body.textContent, /CLM-2048/);
});

test("admin booking heading identifies the event", async () => {
  scenario = {
    intercept: (path) =>
      path === "/v1/admin/booking-requests/booking-1"
        ? Promise.resolve(
            json({
              bookingRequest: {
                id: "booking-1",
                reference: "BR-private-uuid",
                eventType: "Wedding",
                packageName: "Garden package",
                contactName: "Ada Santos",
                phoneNumber: "123",
                requestedDays: [],
                requestedServices: [],
                preferredDate: null,
                status: "under_review",
                timeZone: "Asia/Manila",
                createdAt: time,
                updatedAt: time,
              },
            }),
          )
        : null,
  };
  await render(BookingRequestPage, { bookingRequestId: "booking-1" });
  assert.equal(
    container.querySelector("h1")?.textContent,
    "Wedding booking request",
  );
  assert.match(container.textContent, /Garden package/);
  assert.doesNotMatch(container.textContent, /BR-private-uuid/);
});

test("open package selector and editor disappear when eligibility changes", async () => {
  scenario = {};
  await render(BookingPackage, {
    id: "booking-1",
    admin: true,
    editable: true,
  });
  await click("Choose catalog package");
  assert.ok(button("Assign package"));
  await render(
    BookingPackage,
    { id: "booking-1", admin: true, editable: false },
    false,
  );
  assert.equal(button("Assign package"), undefined);
  assert.equal(button("Create custom package"), undefined);
  assert.equal(writes().length, 0);
  await render(
    BookingPackage,
    { id: "booking-1", admin: true, editable: true },
    false,
  );
  await click("Create custom package");
  assert.ok(container.querySelector("dialog"));
  await render(
    BookingPackage,
    { id: "booking-1", admin: true, editable: false },
    false,
  );
  assert.equal(container.querySelector("dialog"), null);
  assert.equal(writes().length, 0);
});

test("late booking refresh cannot enable writes in a different quotation scope", async () => {
  let resolveOld;
  let firstBookingCalls = 0;
  scenario = {
    quote: quotation("sent"),
    intercept: (path) => {
      if (path.endsWith("/booking-1")) {
        firstBookingCalls++;

        if (firstBookingCalls === 1)
          return Promise.resolve(json({ error: "Unavailable" }, 503));

        return new Promise((resolve) => {
          resolveOld = resolve;
        });
      }

      if (path.endsWith("/booking-2"))
        return Promise.resolve(
          json({
            bookingRequest: {
              id: "booking-2",
              status: "cancelled",
              updatedAt: time,
            },
          }),
        );

      return null;
    },
  };
  await render(Quotations, {
    admin: true,
    bookingId: "booking-1",
    quotationId: "quote-1",
  });
  await click("Refresh booking");
  await render(
    Quotations,
    { admin: true, bookingId: "booking-2", quotationId: "quote-2" },
    false,
  );
  assert.match(container.textContent, /request is cancelled/);
  await act(async () =>
    resolveOld(
      json({
        bookingRequest: {
          id: "booking-1",
          status: "under_review",
          updatedAt: time,
        },
      }),
    ),
  );
  await flush();
  assert.match(container.textContent, /request is cancelled/);
  assert.equal(button("Revise this offer"), undefined);
  assert.equal(writes().length, 0);
});

test("catalog assignment conflict requires a booking refresh before retry", async () => {
  scenario = { conflict: true };
  let refreshes = 0;
  await render(BookingPackage, {
    id: "booking-1",
    admin: true,
    editable: true,
    refreshBooking: async () => {
      refreshes++;
    },
  });
  await click("Choose catalog package");
  const select = container.querySelector("select");
  await act(async () => {
    select.value = "catalog-1";
    select.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
  await click("Assign package");
  assert.equal(writes().length, 1);
  assert.equal(button("Assign package"), undefined);
  assert.match(container.textContent, /Refresh the booking before retrying/);
  scenario.conflict = false;
  await click("Refresh booking");
  assert.equal(refreshes, 1);
  assert.equal(writes().length, 1);
  await click("Choose catalog package");
  assert.ok(button("Assign package"));
});

test("closed booking preserves sent offer and expandable superseded history", async () => {
  scenario = {
    quote: quotation("sent"),
    history: [
      {
        ...quotation("superseded"),
        id: "old-quote",
        version: 0,
        sentAt: time,
        supersededAt: time,
        items: [{ ...item, description: "Earlier flowers" }],
      },
    ],
  };
  await render(Quotations, {
    admin: true,
    bookingId: "booking-1",
    bookingStatus: "declined",
  });
  assert.match(container.textContent, /Sent/);
  assert.match(container.textContent, /Earlier versions/);

  const history = [...container.querySelectorAll("button")].find((element) =>
    element.textContent.includes("Version 0"),
  );

  assert.ok(history);
  await act(async () =>
    history.dispatchEvent(new window.MouseEvent("click", { bubbles: true })),
  );
  assert.match(container.textContent, /Earlier flowers/);
  assert.equal(button("Revise this offer"), undefined);
  assert.equal(writes().length, 0);
});

test("customer exact-version view uses the requested offer and has no admin writes", async () => {
  scenario = { quote: quotation("sent") };
  await render(Quotations, {
    admin: false,
    bookingId: "booking-1",
    quotationId: "quote-1",
  });
  assert.match(container.textContent, /Flowers/);
  assert.match(container.textContent, /Discuss this offer in Messages/);
  assert.equal(button("Revise this offer"), undefined);
  assert.equal(button("Send"), undefined);
  assert.ok(requests.some(({ path }) => path === "/v1/quotations/quote-1"));
  assert.equal(writes().length, 0);
});

const addonItem = (addon = {}) => ({
  id: "5a3eac5e-a281-4a1c-8ce1-a42922224011",
  direction: "add",
  kind: "addition",
  description: "Extra lighting",
  serviceId: "service-1",
  amountMinor: 20000,
  addon: {
    source: {
      packageId: "package-1",
      addonId: "5a3eac5e-a281-4a1c-8ce1-a42922224011",
      fixedPriceMinor: 20000,
      includedHours: 2,
      hourlyRateMinor: 5000,
    },
    fixedPriceOverrideMinor: null,
    hourlyRateOverrideMinor: null,
    hours: 0,
    ...addon,
  },
});

const hourlyItem = () => {
  const fixed = addonItem();
  const id = "439e6501-048d-4337-8161-56801bb37bbb";

  return {
    ...fixed,
    id,
    serviceId: "service-2",
    description: "Sound system",
    amountMinor: null,
    addon: {
      ...fixed.addon,
      source: {
        ...fixed.addon.source,
        addonId: id,
        fixedPriceMinor: null,
        includedHours: null,
      },
      hours: null,
    },
  };
};

async function change(label, value) {
  const scope = document.querySelector("dialog[open]") ?? container;

  const labelNode = [...scope.querySelectorAll("label")].find((node) =>
    node.textContent.trim().startsWith(label),
  );

  assert.ok(labelNode, `Missing label ${label}`);
  const control = document.getElementById(labelNode.htmlFor);
  const prototype = Object.getPrototypeOf(control);
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  assert.ok(setter, `Missing value setter for ${label}`);

  await act(async () => {
    setter.call(control, value);
    control.dispatchEvent(
      new window.Event(control.tagName === "SELECT" ? "change" : "input", {
        bubbles: true,
      }),
    );
  });

  return control;
}

async function renderAdmin(props = {}) {
  await render(Quotations, {
    admin: true,
    bookingId: "booking-1",
    bookingStatus: "under_review",
    ...props,
  });
}

for (const status of [...openStatuses, ...closedStatuses]) {
  test(`quotation actions honor the ${status} booking status`, async () => {
    scenario = { quote: quotation() };
    await renderAdmin({ bookingStatus: status });
    assert.match(container.textContent, /Flowers/);

    if (openStatuses.includes(status)) {
      await click("Revise this offer");
      assert.ok(button("Send"));
      assert.equal(button("Send").disabled, true);
      assert.ok(button("Cancel"));
      assert.equal(button("Save adjustments"), undefined);
      assert.doesNotMatch(container.textContent, /Draft/);
    } else {
      assert.match(container.textContent, new RegExp(`request is ${status}`));
      assert.equal(button("Revise this offer"), undefined);
      assert.equal(button("Prepare quotation"), undefined);
    }

    assert.equal(writes().length, 0);
  });
}

test("missing proposal blocks preparation", async () => {
  scenario = {};
  await renderAdmin({ proposalAvailable: false });
  assert.match(container.textContent, /Prepare or choose a package/);
  assert.equal(button("Prepare quotation"), undefined);
  assert.equal(writes().length, 0);
});

test("booking add-on edits save pricing and total hours through booking API", async () => {
  const service = {
    id: "addon-1",
    serviceId: "service-1",
    name: "Lighting",
    hours: 2,
    notes: null,
    included: false,
    updatedAt: time,
    offer: {
      fixedPricePesos: 200,
      includedHours: 2,
      hourlyRatePesos: 50,
      totalHours: 3,
    },
  };
  const booking = {
    id: "booking-1",
    status: "under_review",
    updatedAt: time,
    requestedServices: [service],
  };
  let saved;
  scenario = {
    intercept: (path, method) =>
      path.endsWith("/addons/addon-1") && method === "PATCH"
        ? Promise.resolve(
            json({ bookingRequest: { ...booking, updatedAt: laterRevision } }),
          )
        : null,
  };
  await render(BookingOfferAddons, {
    booking,
    onChanged: (next) => {
      saved = next;
    },
  });
  await click("Edit Lighting");
  await change("Total hours", "5");
  await change("Fixed price", "250");
  await render(
    BookingOfferAddons,
    {
      booking: { ...booking, updatedAt: laterRevision },
      onChanged: (next) => {
        saved = next;
      },
    },
    false,
  );
  await click("Save add-on");
  assert.deepEqual(JSON.parse(writes()[0].body), {
    expectedBookingUpdatedAt: time,
    totalHours: 5,
    pricing: { fixedPricePesos: 250, includedHours: 2, hourlyRatePesos: 50 },
  });
  assert.equal(saved.updatedAt, laterRevision);
});

test("request-only service is offered by its row and removal uses booking revision", async () => {
  const service = {
    id: "request-1",
    serviceId: "service-1",
    name: "Lighting",
    hours: 3,
    notes: null,
    included: false,
    updatedAt: time,
    catalogPricing: {
      fixedPricePesos: null,
      includedHours: null,
      hourlyRatePesos: 50,
    },
  };
  const booking = {
    id: "booking-1",
    status: "under_review",
    updatedAt: time,
    requestedServices: [service],
  };
  scenario = {
    intercept: (path, method) =>
      path.endsWith("/addons/request-1") && method === "PATCH"
        ? Promise.resolve(json({ bookingRequest: booking }))
        : null,
  };
  await render(BookingOfferAddons, { booking, onChanged: () => {} });
  await click("Add Lighting");
  await click("Save add-on");
  assert.equal(
    writes()[0].path,
    "/v1/admin/booking-requests/booking-1/addons/request-1",
  );
  assert.equal(JSON.parse(writes()[0].body).totalHours, 3);
});

test("preparation shows server-owned add-ons and cancellation writes nothing", async () => {
  scenario = { addons: [addonItem(), hourlyItem()] };
  await renderAdmin();
  await click("Prepare quotation");
  assert.match(container.textContent, /Extra lighting/);
  assert.match(container.textContent, /Sound system/);
  assert.equal(
    container.querySelector('[aria-label="Extra hours for Extra lighting"]'),
    null,
  );
  assert.equal(button("Send").disabled, true);
  await click("Cancel");
  assert.equal(writes().length, 0);
});

test("canceling a prepared revision keeps the prior offer and drops its local reason", async () => {
  scenario = { quote: quotation() };
  await renderAdmin();
  await click("Revise this offer");
  await change("Reason for the revision", "Customer requested changes");
  assert.equal(button("Send").disabled, false);
  await click("Cancel");
  assert.match(container.textContent, /Version 1 was sent/);
  assert.doesNotMatch(container.textContent, /Earlier versions/);
  assert.equal(writes().length, 0);
  await click("Revise this offer");
  assert.equal(container.querySelector("textarea").value, "");
});

test("open quotation composer closes when its booking closes", async () => {
  scenario = { quote: quotation() };
  await renderAdmin();
  await click("Revise this offer");
  await change("Reason for the revision", "Customer requested changes");
  await render(
    Quotations,
    { admin: true, bookingId: "booking-1", bookingStatus: "cancelled" },
    false,
  );
  assert.match(container.textContent, /Version 1 was sent/);
  assert.equal(button("Send"), undefined);
  assert.equal(writes().length, 0);
});

test("exact-version admin message displays the requested delivered version", async () => {
  const previous = {
    ...quotation("superseded"),
    sentAt: time,
    supersededAt: time,
    id: "previous",
    items: [{ ...item, description: "Earlier flowers" }],
  };
  scenario = { quote: { ...quotation(), version: 2 }, history: [previous] };
  await renderAdmin({ quotationId: previous.id });
  assert.match(container.textContent, /Earlier flowers/);
  assert.match(container.textContent, /Superseded/);
  assert.doesNotMatch(container.textContent, /Version 2/);
  assert.equal(button("Revise this offer"), undefined);
  assert.equal(button("Send"), undefined);
});

test("latest delivered legacy fallback is the current offer", async () => {
  scenario = {
    quote: { ...quotation("superseded"), sentAt: time, supersededAt: time },
  };
  await renderAdmin();
  assert.match(container.textContent, /Current offer/);
  assert.doesNotMatch(container.textContent, /Replaced by a newer version/);
  assert.ok(button("Revise this offer"));
});

test("send includes only manual adjustments alongside server-owned add-ons", async () => {
  scenario = { addons: [addonItem()] };
  await renderAdmin();
  await click("Prepare quotation");
  await click("Add fee or discount");
  await change("Description", "Delivery fee");
  await change("Amount (PHP)", "50");
  await click("Apply");
  await click("Send");
  const sent = JSON.parse(writes()[0].body);
  assert.equal(sent.items.length, 1);
  assert.equal(sent.items[0].description, "Delivery fee");
  assert.equal(sent.items[0].serviceId, null);
  assert.equal(sent.items[0].addon, undefined);
});

test("prepare quotation shows each add-on once, without the booking editor", async () => {
  scenario = { addons: [addonItem({ totalHours: 3 })] };
  await renderAdmin();
  await click("Prepare quotation");
  assert.match(container.textContent, /Extra lighting/);
  assert.match(container.textContent, /3 hours/);
  assert.doesNotMatch(container.textContent, /for 2 hours/);
  assert.doesNotMatch(container.textContent, /Booking add-ons/);
  assert.doesNotMatch(container.textContent, /Additional requests/);
  assert.equal(button("Edit Extra lighting"), undefined);
  await click("Add fee or discount");
  await change("Description", "Delivery fee");
  await change("Amount (PHP)", "50");
  await click("Apply");
  assert.match(container.textContent, /Delivery fee/);
  await click("Send");
  const sent = JSON.parse(writes().at(-1).body);
  assert.equal(sent.items.length, 1);
  assert.equal(sent.items[0].description, "Delivery fee");
});

test("a successful replay of a superseded offer waits for the authoritative latest offer", async () => {
  const superseded = {
    ...quotation("superseded"),
    id: "replayed-offer",
    version: 2,
    sentAt: time,
    supersededAt: laterRevision,
  };

  const latest = { ...quotation(), id: "latest-offer", version: 3 };

  let retry = false;
  let completeRefresh;
  scenario = {
    quote: quotation(),
    intercept: (path, method) => {
      if (method === "POST" && path.endsWith("/send"))
        return Promise.resolve(
          retry
            ? json({ quotation: superseded })
            : json({ error: "Response lost" }, 503),
        );

      if (retry && method === "GET" && path.endsWith("/quotations"))
        return new Promise((resolve) => {
          completeRefresh = resolve;
        });

      return null;
    },
  };
  await renderAdmin();
  await click("Revise this offer");
  await change("Reason for the revision", "Adjust the offer");
  await click("Send");
  retry = true;
  await click("Send");

  assert.deepEqual(JSON.parse(writes()[1].body), JSON.parse(writes()[0].body));
  assert.match(
    container.querySelector(".quotation-offer-hero").textContent,
    /Version 1/,
  );
  assert.match(container.textContent, /Loading quotations/);
  assert.equal(button("Send"), undefined);

  await act(async () =>
    completeRefresh(
      json({
        quotations: [latest, superseded],
        currentOffer: latest,
        nextCursor: null,
      }),
    ),
  );
  assert.match(
    container.querySelector(".quotation-offer-hero").textContent,
    /Version 3/,
  );
  assert.match(container.textContent, /Version 2 · Superseded/);
});

test("double-click send submits one request while the first response is pending", async () => {
  let complete;
  scenario = {
    intercept: (path) =>
      path.endsWith("/send")
        ? new Promise((resolve) => {
            complete = resolve;
          })
        : null,
  };
  await renderAdmin();
  await click("Prepare quotation");
  const send = button("Send");

  await act(async () => {
    send.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    send.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  });
  assert.equal(writes().length, 1);
  assert.equal(button("Sending…").disabled, true);
  assert.equal(button("Cancel").disabled, true);
  await act(async () => complete(json({ error: "Try later" }, 503)));
});

test("canceling a pending preparation ignores its late response", async () => {
  let complete;
  scenario = {
    intercept: (path) =>
      path.endsWith("/prepare")
        ? new Promise((resolve) => {
            complete = resolve;
          })
        : null,
  };
  await renderAdmin();
  await click("Prepare quotation");
  await click("Cancel");
  await act(async () =>
    complete(json({ error: "Late preparation failure" }, 500)),
  );
  await flush();
  assert.ok(button("Prepare quotation"));
  assert.doesNotMatch(document.body.textContent, /Late preparation failure/);
  assert.equal(writes().length, 0);
});
