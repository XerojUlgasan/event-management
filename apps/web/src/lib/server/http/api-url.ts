import { config } from "../../../env";

const defaultServerApiUrl = "http://127.0.0.1:3000/v1";

export function getServerApiUrl() {
  const proxy = config.API_PROXY_TARGET?.replace(/\/$/, "");

  if (proxy) return `${proxy}/functions/v1/api/v1`;

  const { SERVER_PUBLIC_API_URL } = config;

  if (SERVER_PUBLIC_API_URL && /^https?:\/\//.test(SERVER_PUBLIC_API_URL))
    return SERVER_PUBLIC_API_URL.replace(/\/$/, "");

  return defaultServerApiUrl;
}
