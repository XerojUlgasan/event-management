import type { APIRoute } from "astro";

// Register /v1/* so Astro runs the API proxy middleware for every HTTP method.
// The middleware forwards the request when API_PROXY_TARGET is configured.
export const ALL: APIRoute = () =>
  new Response("The API proxy is not configured.", { status: 503 });
