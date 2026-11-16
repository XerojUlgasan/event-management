import { defineMiddleware } from "astro:middleware";
import { env } from "./lib/server/config/env";

const dropped = [
  "connection",
  "keep-alive",
  "transfer-encoding",
  "content-encoding",
  "content-length",
  "access-control-allow-origin",
  "access-control-allow-credentials",
  "access-control-allow-headers",
  "access-control-allow-methods",
];

export const onRequest = defineMiddleware(async (context, next) => {
  const target = env.API_PROXY_TARGET;
  if (!target || !context.url.pathname.startsWith("/v1")) return next();

  const path = context.url.pathname.replace(
    /^\/v1(?=\/|$)/,
    "/functions/v1/api/v1",
  );
  const upstream = new URL(`${path}${context.url.search}`, target);
  const headers = new Headers(context.request.headers);
  headers.delete("host");
  const hasBody =
    context.request.method !== "GET" && context.request.method !== "HEAD";
  try {
    const response = await fetch(upstream, {
      method: context.request.method,
      headers,
      body: hasBody ? await context.request.arrayBuffer() : undefined,
      redirect: "manual",
    });
    const outgoing = new Headers(response.headers);
    for (const name of dropped) outgoing.delete(name);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: outgoing,
    });
  } catch (error) {
    console.error(error);
    return new Response("The API could not be reached.", { status: 502 });
  }
});
