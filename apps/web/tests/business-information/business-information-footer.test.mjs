import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));

let server;
let cacheDir;
let BusinessInformationFooter;
let emptyBusinessInformation;

before(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), "amac-bi-footer-ssr-"));
  server = await createServer({
    root,
    cacheDir,
    configFile: false,
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
  ({ BusinessInformationFooter } = await server.ssrLoadModule(
    "/src/components/public/site/BusinessInformationFooter.tsx",
  ));
  ({ emptyBusinessInformation } = await server.ssrLoadModule(
    "/@fs" +
      fileURLToPath(
        new URL(
          "../../../../packages/contracts/src/business-information.ts",
          import.meta.url,
        ),
      ),
  ));
});

after(async () => {
  try {
    await server?.close();
  } finally {
    if (cacheDir) await rm(cacheDir, { recursive: true, force: true });
  }
});

const populatedInformation = () => ({
  ...emptyBusinessInformation(),
  about: {
    ...emptyBusinessInformation().about,
    name: "Styled by AMAC",
    introduction: "<b>Welcome</b>",
    tagline: "Should not appear",
    description: "Hidden description",
  },
  contact: {
    ...emptyBusinessInformation().contact,
    phone: "+63 912 345 6789",
    email: "team@example.com",
    website: "https://example.com",
    facebook: "https://facebook.com/styledbyamac",
    instagram: "https://instagram.com/styledbyamac",
  },
  location: {
    ...emptyBusinessInformation().location,
    address: "123 Main St",
    city: "Manila",
    mapUrl: "https://maps.example.com/place",
    serviceAreas: "Metro Manila",
  },
  hours: {
    ...emptyBusinessInformation().hours,
    supportHours: "Mon–Fri, 9am–5pm",
    monday: "9:00–17:00",
    timeZone: "Asia/Manila",
  },
  inquiries: {
    ...emptyBusinessInformation().inquiries,
    typicalResponseTime: "1 business day",
  },
  policies: {
    ...emptyBusinessInformation().policies,
    cancellation: "Contact us as early as possible.",
  },
  faqs: [{ question: "Hours?", answer: "Weekdays" }],
  otherLinks: [{ label: "Portfolio", url: "https://example.com/work" }],
});

test("footer renders public basics in a full footer element", () => {
  const html = renderToStaticMarkup(
    createElement(BusinessInformationFooter, {
      information: populatedInformation(),
    }),
  );

  assert.match(html, /<footer[^>]*id="business-information"/);
  assert.match(html, /business-information-footer/);
  assert.match(html, /brand-light/);
  assert.match(html, /href="\/packages"/);
  assert.match(html, /href="\/services"/);
  assert.match(html, />Styled by AMAC</);
  assert.doesNotMatch(html, /<h1/);

  assert.equal(
    (html.match(/business-information-footer-name/g) ?? []).length,
    1,
  );
  assert.match(html, /alt="Styled by AMAC"/);
  assert.match(html, /&lt;b&gt;Welcome&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>Welcome<\/b>/);
  assert.match(html, /mailto:team%40example\.com/);
  assert.match(html, /tel:\+639123456789/);
  assert.match(html, />Facebook</);
  assert.match(html, /https:\/\/facebook\.com\/styledbyamac/);
  assert.match(html, />Instagram</);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, />View on map</);
  assert.match(html, /123 Main St/);
  assert.match(html, /Metro Manila/);
  assert.match(html, /Mon–Fri, 9am–5pm/);

  assert.doesNotMatch(html, /Should not appear/);
  assert.doesNotMatch(html, /Hidden description/);
  assert.doesNotMatch(html, /https:\/\/example\.com/);
  assert.doesNotMatch(html, /<dt>City<\/dt>/);
  assert.match(html, /Metro Manila/);
  assert.doesNotMatch(html, /Asia\/Manila/);
  assert.doesNotMatch(html, /1 business day/);
  assert.doesNotMatch(html, /Portfolio/);
  assert.doesNotMatch(html, /Browse packages/);
  assert.doesNotMatch(html, /not available yet/);
  assert.doesNotMatch(html, /Business information/);
});

test("footer uses compact fallback for null, empty, and hidden-only data", () => {
  const hiddenOnly = {
    ...emptyBusinessInformation(),
    about: {
      ...emptyBusinessInformation().about,
      tagline: "Hidden tagline",
    },
    contact: {
      ...emptyBusinessInformation().contact,
      website: "https://example.com",
    },
    policies: {
      ...emptyBusinessInformation().policies,
      cancellation: "Hidden policy",
    },
    faqs: [{ question: "Q?", answer: "A" }],
  };

  for (const information of [null, emptyBusinessInformation(), hiddenOnly]) {
    const html = renderToStaticMarkup(
      createElement(BusinessInformationFooter, { information }),
    );

    assert.match(html, /<footer[^>]*id="business-information"/);
    assert.match(html, /Thoughtful event planning/);
    assert.match(html, /href="\/packages"/);
    assert.match(html, /©/);
    assert.doesNotMatch(html, /<h2/);
    assert.doesNotMatch(html, /Hidden tagline/);
    assert.doesNotMatch(html, /Hidden policy/);
    assert.doesNotMatch(html, /not available yet/);
    assert.doesNotMatch(html, /button-primary/);
  }
});

test("footer omits groups that have no public fields", () => {
  const information = {
    ...emptyBusinessInformation(),
    about: {
      ...emptyBusinessInformation().about,
      name: "Solo Name",
    },
    contact: {
      ...emptyBusinessInformation().contact,
      email: "hello@example.com",
    },
  };

  const html = renderToStaticMarkup(
    createElement(BusinessInformationFooter, { information }),
  );

  assert.match(html, />Solo Name</);
  assert.match(html, /hello@example.com/);
  assert.doesNotMatch(html, /id="bi-footer-location"/);
  assert.doesNotMatch(html, /id="bi-footer-hours"/);
  assert.doesNotMatch(html, />Location</);
  assert.doesNotMatch(html, />Opening hours</);
});

test("footer escapes multiline field text", () => {
  const information = {
    ...emptyBusinessInformation(),
    about: {
      ...emptyBusinessInformation().about,
      introduction: "Line one\n<script>alert(1)</script>",
    },
    location: {
      ...emptyBusinessInformation().location,
      serviceAreas: "Area &amp; region",
    },
  };

  const html = renderToStaticMarkup(
    createElement(BusinessInformationFooter, { information }),
  );

  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /Area &amp;amp; region/);
});
