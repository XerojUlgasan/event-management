import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// The local Supabase gateway forces Access-Control-Allow-Origin: *, which browsers
// reject when the page sends cookies. pnpm dev sets API_PROXY_TARGET so browser
// calls stay on the website origin and this server forwards them to the gateway.
const apiProxyTarget = process.env.API_PROXY_TARGET;

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    // Bundle the Markdown renderer so its stylesheet is handled during SSR.
    resolve: {
      noExternal: ["@uiw/react-markdown-preview"],
      // React's integration inlines Babel helpers by default; these are CJS.
      external: ["@babel/runtime"],
    },
    ...(apiProxyTarget
      ? {
          server: {
            proxy: {
              "/v1": {
                target: apiProxyTarget,
                changeOrigin: true,
                proxyTimeout: 90000,
                timeout: 90000,
                rewrite: (path) =>
                  path.replace(/^\/v1(?=\/|\?|$)/, "/functions/v1/api/v1"),
              },
            },
          },
        }
      : {}),
  },
});
