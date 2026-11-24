import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import node from "@astrojs/node";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { config } from "./src/env.ts";

// The local Supabase gateway forces Access-Control-Allow-Origin: *, which browsers
// reject when the page sends cookies. pnpm dev sets API_PROXY_TARGET so browser
// calls stay on the website origin and this server forwards them to the gateway.
const apiProxyTarget = config.API_PROXY_TARGET;
const useCloudflare = config.ASTRO_ADAPTER === "cloudflare";

export default defineConfig({
  output: "server",
  server: {
    allowedHosts: ["localhost:4322", "amac.zxero.dev"],
  },
  adapter: useCloudflare
    ? cloudflare({ imageService: "passthrough" })
    : node({ mode: "standalone" }),
  // Clemora's API manages its own sessions.
  ...(useCloudflare ? { session: false } : {}),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    // Bundle the Markdown renderer so its stylesheet is handled during SSR.
    resolve: {
      noExternal: ["@uiw/react-markdown-preview"],
      // Keep the CJS Babel helpers external for the Node build.
      ...(!useCloudflare ? { external: ["@babel/runtime"] } : {}),
    },
    ...(!useCloudflare && apiProxyTarget
      ? {
          server: {
            proxy: {
              "/v1": {
                target: apiProxyTarget,
                changeOrigin: true,
                rewrite: (path) =>
                  path.replace(/^\/v1(?=\/|\?|$)/, "/functions/v1/api/v1"),
              },
            },
          },
        }
      : {}),
  },
});
