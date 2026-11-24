import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { existsSync } from "node:fs";
import { config } from "./src/env.ts";

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
        name: "clemora-dev-proxy",
        apply: "serve",
        configEnvironment(name) {
          if (name !== "ssr") return;

          // Pass the local proxy setting to workerd. Shell values win.
          if (existsSync(".env")) process.loadEnvFile(".env");

          const target = config.API_PROXY_TARGET;

          if (!target) return;

          return {
            define: {
              __CLEMORA_DEV_PROXY_TARGET__: JSON.stringify(target),
            },
          };
        },
      },
    ],
    // Bundle the Markdown renderer so its stylesheet is handled during SSR.
    resolve: {
      noExternal: ["@uiw/react-markdown-preview"],
    },
  },
});
