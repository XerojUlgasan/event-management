import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// The local Supabase gateway forces Access-Control-Allow-Origin: *, which browsers
// reject when the page sends cookies. pnpm dev sets API_PROXY_TARGET so browser
// calls stay on the website origin and this server forwards them to the gateway.
const apiProxyTarget = process.env.API_PROXY_TARGET;

export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    ...(apiProxyTarget
      ? {
          server: {
            proxy: {
              "/v1": {
                target: apiProxyTarget,
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/v1(?=\/|\?|$)/, "/functions/v1/api/v1"),
              },
            },
          },
        }
      : {}),
  },
});
