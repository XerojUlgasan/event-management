import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));

let server;
let cacheDir;
let display;
let contracts;

before(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), "clemora-bi-display-"));
  server = await createServer({
    root,
    cacheDir,
    configFile: false,
    appType: "custom",
    server: { middlewareMode: true },
    logLevel: "silent",
  });
  display = await server.ssrLoadModule(
    "/src/lib/utils/business-information/display.ts",
  );
  contracts = await server.ssrLoadModule(
    "/@fs" +
      fileURLToPath(
        new URL(
          "../../../../packages/contracts/src/business-information.ts",
          import.meta.url,
        ),
      ),
  );
});

after(async () => {
  try {
    await server?.close();
  } finally {
    if (cacheDir) await rm(cacheDir, { recursive: true, force: true });
  }
});

test("isBusinessUrlField covers social and catalog URLs", () => {
  const { isBusinessUrlField } = display;
  assert.equal(isBusinessUrlField("contact", "instagram"), true);
  assert.equal(isBusinessUrlField("contact", "facebook"), true);
  assert.equal(isBusinessUrlField("contact", "whatsapp"), true);
  assert.equal(isBusinessUrlField("contact", "phone"), false);
});

test("schema accepts blanks and rejects invalid urls", () => {
  const { businessInformationSchema, emptyBusinessInformation } = contracts;
  assert.equal(
    businessInformationSchema.safeParse(emptyBusinessInformation()).success,
    true,
  );
  assert.equal(
    businessInformationSchema.safeParse({
      ...emptyBusinessInformation(),
      contact: {
        ...emptyBusinessInformation().contact,
        website: "ftp://example.com",
      },
    }).success,
    false,
  );
});

test("telHref keeps digits for telephone links", () => {
  const { telHref } = display;
  assert.equal(telHref("(02) 8123-4567"), "tel:0281234567");
  assert.equal(telHref(""), null);
});

test("empty state counts only the selected basic details", () => {
  const information = contracts.emptyBusinessInformation();
  information.policies.cancellation = "Previously saved policy";
  information.inquiries.bookingConfirmation = "Previously saved guidance";
  information.about.description = "Previously saved long description";
  information.hours.monday = "Previously saved daily hours";
  information.faqs = [{ question: "A question", answer: "An answer" }];
  information.otherLinks = [{ label: "Portfolio", url: "https://example.com" }];
  assert.equal(display.businessInformationIsEmpty(information), true);

  information.hours.supportHours = "Mon–Fri, 9am–5pm";
  assert.equal(display.businessInformationIsEmpty(information), false);
});
