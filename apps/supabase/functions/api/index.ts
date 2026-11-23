import { app } from "./_generated/app.js";

const functionPrefixes = ["/functions/v1/api", "/api"];

function withApiPath(request: Request) {
  const url = new URL(request.url);

  const prefix = functionPrefixes.find(
    (item) => url.pathname === item || url.pathname.startsWith(`${item}/`),
  );

  if (!prefix) return request;

  url.pathname = url.pathname.slice(prefix.length) || "/";

  return new Request(url, request);
}

export default {
  fetch(request: Request) {
    return app.fetch(withApiPath(request));
  },
};
