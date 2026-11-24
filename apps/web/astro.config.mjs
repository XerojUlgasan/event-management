import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { config } from "./src/env.ts";

const webRoot = fileURLToPath(new URL(".", import.meta.url));

// Capture shell values before the Cloudflare adapter loads its env files.
const publicSettings = Object.entries(config).filter(([name]) =>
  name.startsWith("PUBLIC_"),
);

export default defineConfig({
  output: "server",
  server: {
    allowedHosts: ["localhost:4322", "amac.zxero.dev"],
  },
  adapter: cloudflare({ imageService: "passthrough" }),
  session: false,
  integrations: [react()],
  vite: {
    plugins: [
      tailwindcss(),
      {
        name: "clemora-env",
        config(_config, { mode }) {
          const values = loadEnv(mode, webRoot, "PUBLIC_");

          return {
            define: Object.fromEntries(
              publicSettings.map(([name, shellValue]) => [
                `process.env.${name}`,
                JSON.stringify(shellValue ?? values[name]) ?? "undefined",
              ]),
            ),
          };
        },
        configEnvironment(name, _config, { command, mode }) {
          if (name === "client")
            return { define: { "process.env.API_PROXY_TARGET": "undefined" } };

          if (name === "ssr" && command === "serve") {
            const target =
              config.API_PROXY_TARGET ??
              loadEnv(mode, webRoot, "API_PROXY_TARGET").API_PROXY_TARGET;

            if (target !== undefined)
              return {
                define: {
                  "process.env.API_PROXY_TARGET": JSON.stringify(target),
                },
              };
          }
        },
      },
    ],
    // Bundle the Markdown renderer so its stylesheet is handled during SSR.
    resolve: {
      noExternal: ["@uiw/react-markdown-preview"],
    },
  },
});
