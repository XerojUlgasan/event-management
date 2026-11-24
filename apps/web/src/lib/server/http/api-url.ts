import { config } from "../../../env";
import { publicApiUrl } from "../../http/request";

export function apiProxyUrl() {
  if (!config.API_PROXY_TARGET) return undefined;

  const target = new URL(config.API_PROXY_TARGET);
  const path = target.pathname.replace(/\/+$/, "") || "/functions/v1/api";

  return `${target.origin}${path.endsWith("/v1") ? path : `${path}/v1`}`;
}

export function serverApiUrl() {
  const proxy = apiProxyUrl();

  if (proxy) return proxy;

  const url = publicApiUrl();

  if (!/^https?:\/\//.test(url))
    throw new Error("Missing environment variable: API_PROXY_TARGET");

  return url;
}
