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
  BookingPackage;
let root, container, requests, scenario;

const openStatuses = ["under_review", "needs_details", "accepted"];

const closedStatuses = ["declined", "cancelled"];

const time = "2026-11-19T00:00:00.000Z";

const item = {
  id: "item-1",
  direction: "add",
  kind: "addition",
  description: "Flowers",
  amountMinor: 5000,
  serviceId: null,
};

const quotation = (status = "draft") => ({
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
  acceptedAt: status === "accepted" ? time : null,
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
    const result = scenario.intercept(path, method);

    if (result) return result;
  }

  if (method !== "GET") {
    if (scenario.conflict)
      return Promise.resolve(json({ error: "Request changed" }, 409));

    return Promise.resolve(json({ quotation: scenario.quote ?? quotation() }));
  }

  if (path.endsWith("/quotations")) {
    const q = scenario.quote;

    return Promise.resolve(
      json({
        quotations: [...(q ? [q] : []), ...(scenario.history ?? [])],
        currentDraft: q?.status === "draft" ? q : null,
        currentOffer: q && ["sent", "accepted"].includes(q.status) ? q : null,
        previousDraftVersion: null,
        nextCursor: null,
      }),
    );
  }

  if (path === "/v1/quotations/quote-1")
    return Promise.resolve(json({ quotation: scenario.quote }));

  if (path.endsWith("/package-history"))
    return Promise.resolve(json({ history: [], nextCursor: null }));

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

  if (path.includes("/admin/booking-requests/"))
    return Promise.resolve(
      json({
        bookingRequest: {
          id: path.split("/").at(-1),
          status: scenario.bookingStatus ?? "under_review",
          updatedAt: time,
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
  ({ BookingPackage } = await server.ssrLoadModule(
    "/src/components/booking-requests/BookingPackage.tsx",
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
  return [...container.querySelectorAll("button")].find(
    (element) => element.textContent.trim() === label,
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

for (const status of [...openStatuses, ...closedStatuses]) {
  test(`quotation draft controls follow ${status}`, async () => {
    scenario = { quote: quotation() };
    await render(Quotations, {
      admin: true,
      bookingId: "booking-1",
      bookingStatus: status,
    });
    assert.match(container.textContent, /Version 1/);

    if (openStatuses.includes(status)) {
      assert.ok(button("Add adjustment"));
      assert.ok(button("Remove"));
      assert.ok(button("Save adjustments"));
      assert.ok(button("Save and send"));
      assert.ok(button("Start another revision"));
      assert.ok(container.querySelector('input[value="Flowers"]'));
      await click("Add adjustment");
      assert.match(container.textContent, /Adjustment 2/);
    } else {
      assert.match(container.textContent, new RegExp(`request is ${status}`));
      assert.match(container.textContent, /Flowers/);

      for (const label of [
        "Add adjustment",
        "Remove",
        "Save adjustments",
        "Save and send",
        "Start another revision",
      ])
        assert.equal(button(label), undefined);

      assert.equal(container.querySelector("input"), null);
      assert.equal(writes().length, 0);
    }
  });
}

test("empty and missing-proposal states honor booking status", async () => {
  scenario = {};
  await render(Quotations, {
    admin: true,
    bookingId: "booking-1",
    bookingStatus: "under_review",
    proposalAvailable: false,
  });
  assert.match(container.textContent, /Prepare or choose a package/);
  assert.equal(button("Create draft"), undefined);
  await render(
    Quotations,
    {
      admin: true,
      bookingId: "booking-1",
      bookingStatus: "under_review",
      proposalAvailable: true,
    },
    false,
  );
  assert.ok(button("Create draft"));
  await render(
    Quotations,
    {
      admin: true,
      bookingId: "booking-1",
      bookingStatus: "cancelled",
      proposalAvailable: false,
    },
    false,
  );
  assert.match(container.textContent, /No quotation yet/);
  assert.match(container.textContent, /read-only/);
  assert.doesNotMatch(container.textContent, /Prepare or choose/);
  assert.equal(button("Create draft"), undefined);
});

test("open revision disappears after closure while sent offer remains readable", async () => {
  scenario = { quote: quotation("sent") };
  await render(Quotations, {
    admin: true,
    bookingId: "booking-1",
    bookingStatus: "accepted",
  });
  await click("Revise this offer");
  assert.ok(button("Start revision"));
  await render(
    Quotations,
    { admin: true, bookingId: "booking-1", bookingStatus: "declined" },
    false,
  );
  assert.match(container.textContent, /Flowers/);
  assert.equal(button("Start revision"), undefined);
  assert.equal(button("Revise this offer"), undefined);
  assert.equal(writes().length, 0);
});

test("message quotation fails closed while booking is unknown or unavailable", async () => {
  let resolveBooking;
  scenario = {
    quote: quotation("sent"),
    intercept: (path) =>
      path.endsWith("/booking-1")
        ? new Promise((resolve) => {
            resolveBooking = resolve;
          })
        : null,
  };
  await render(Quotations, {
    admin: true,
    bookingId: "booking-1",
    quotationId: "quote-1",
  });
  assert.match(container.textContent, /Flowers/);
  assert.equal(button("Revise this offer"), undefined);
  await act(async () =>
    resolveBooking(json({ error: "Booking unavailable" }, 503)),
  );
  await flush();
  assert.match(container.textContent, /Booking unavailable/);
  assert.equal(button("Revise this offer"), undefined);
  scenario.intercept = undefined;
  await click("Refresh booking");
  assert.ok(button("Revise this offer"));
});

test("conflict blocks retry until explicit booking refresh, with no automatic replay", async () => {
  scenario = { quote: quotation(), conflict: true };
  let refreshes = 0;
  await render(Quotations, {
    admin: true,
    bookingId: "booking-1",
    bookingStatus: "under_review",
    refreshBooking: async () => {
      refreshes++;
    },
  });
  await click("Save adjustments");
  assert.equal(writes().length, 1);
  assert.match(container.textContent, /Refresh the booking before retrying/);
  assert.equal(button("Save adjustments"), undefined);
  scenario.conflict = false;
  await click("Refresh booking");
  assert.equal(refreshes, 1);
  assert.equal(writes().length, 1);
  await click("Save adjustments");
  assert.equal(writes().length, 2);
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

test("eligible create and send invoke the existing mutation sequence", async () => {
  scenario = {};
  await render(Quotations, {
    admin: true,
    bookingId: "booking-1",
    bookingStatus: "needs_details",
  });
  await click("Create draft");
  assert.equal(writes().length, 1);
  assert.match(writes()[0].path, /booking-1\/quotations$/);
  await act(async () => root.unmount());
  root = null;
  container.remove();
  scenario = { quote: quotation() };
  await render(Quotations, {
    admin: true,
    bookingId: "booking-1",
    bookingStatus: "under_review",
  });
  await click("Save and send");
  assert.deepEqual(
    writes().map(({ path, method }) => [path, method]),
    [
      ["/v1/admin/quotations/quote-1", "PATCH"],
      ["/v1/admin/quotations/quote-1/send", "POST"],
    ],
  );
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

test("sent offer revision submits the entered reason on an eligible booking", async () => {
  scenario = { quote: quotation("sent") };
  await render(Quotations, {
    admin: true,
    bookingId: "booking-1",
    bookingStatus: "under_review",
  });
  await click("Revise this offer");
  const reason = container.querySelector("textarea");
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value",
  ).set;
  await act(async () => {
    setter.call(reason, "Customer requested changes");
    reason.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  await click("Start revision");
  assert.equal(writes().length, 1);
  assert.match(writes()[0].path, /quote-1\/revision$/);
  assert.equal(
    JSON.parse(writes()[0].body).reason,
    "Customer requested changes",
  );
});

for (const transition of ["unmount", "scope", "closed"]) {
  test(`pending save and send stops after ${transition}`, async () => {
    let resolveSave;
    scenario = {
      quote: quotation(),
      intercept: (path, method) =>
        method === "PATCH" && path.endsWith("/quote-1")
          ? new Promise((resolve) => {
              resolveSave = resolve;
            })
          : null,
    };
    await render(Quotations, {
      admin: true,
      bookingId: "booking-1",
      bookingStatus: "under_review",
    });
    await click("Save and send");
    assert.equal(writes().length, 1);

    if (transition === "unmount") {
      await act(async () => root.unmount());
      root = null;
    } else if (transition === "scope") {
      scenario.quote = {
        ...quotation(),
        id: "quote-2",
        bookingRequestId: "booking-2",
        items: [{ ...item, description: "Other booking" }],
      };
      await render(
        Quotations,
        { admin: true, bookingId: "booking-2", bookingStatus: "accepted" },
        false,
      );
      assert.ok(container.querySelector('input[value="Other booking"]'));
    } else {
      await render(
        Quotations,
        { admin: true, bookingId: "booking-1", bookingStatus: "cancelled" },
        false,
      );
      assert.match(container.textContent, /request is cancelled/);
    }

    await act(async () =>
      resolveSave(
        json({
          quotation: {
            ...quotation(),
            items: [{ ...item, description: "Stale save" }],
          },
        }),
      ),
    );
    await flush();
    assert.equal(writes().length, 1);
    assert.equal(
      requests.some(({ path }) => path.endsWith("/send")),
      false,
    );
    assert.doesNotMatch(document.body.textContent, /Quotation saved and sent/);

    if (transition === "scope") {
      assert.ok(container.querySelector('input[value="Other booking"]'));
      assert.doesNotMatch(container.textContent, /Stale save/);
      assert.equal(button("Save adjustments").disabled, false);
    }
  });
}

for (const transition of ["unmount", "scope"]) {
  test(`pending create preflight stops after ${transition}`, async () => {
    let resolveBooking;
    scenario = {
      intercept: (path) =>
        path.endsWith("/booking-1")
          ? new Promise((resolve) => {
              resolveBooking = resolve;
            })
          : null,
    };
    await render(Quotations, {
      admin: true,
      bookingId: "booking-1",
      bookingStatus: "under_review",
    });
    await click("Create draft");

    if (transition === "unmount") {
      await act(async () => root.unmount());
      root = null;
    } else {
      await render(
        Quotations,
        { admin: true, bookingId: "booking-2", bookingStatus: "accepted" },
        false,
      );
    }

    await act(async () =>
      resolveBooking(
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
    assert.equal(writes().length, 0);
    assert.doesNotMatch(document.body.textContent, /Quotation draft created/);

    if (transition === "scope")
      assert.equal(button("Create draft").disabled, false);
  });
}

test("message quotation reloads booking status when its exact version changes", async () => {
  scenario = { quote: quotation("sent") };
  await render(Quotations, {
    admin: true,
    bookingId: "booking-1",
    quotationId: "quote-1",
  });
  assert.ok(button("Revise this offer"));
  await render(
    Quotations,
    { admin: true, bookingId: "booking-1", quotationId: "quote-2" },
    false,
  );
  assert.ok(button("Revise this offer"));
  assert.equal(
    requests.filter(({ path }) => path.endsWith("/booking-1")).length,
    2,
  );
});

test("closed booking preserves accepted offer and expandable superseded history", async () => {
  scenario = {
    quote: quotation("accepted"),
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
  assert.match(container.textContent, /Accepted/);
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
  assert.equal(button("Save and send"), undefined);
  assert.ok(requests.some(({ path }) => path === "/v1/quotations/quote-1"));
  assert.equal(writes().length, 0);
});
