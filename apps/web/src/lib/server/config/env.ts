type ServerEnv = {
  API_PROXY_TARGET?: string;
  PUBLIC_API_URL?: string;
};

const DEFAULT_SERVER_API_URL = "http://127.0.0.1:3000/v1";

// No Astro virtual modules or dotenv loading: this is also used before Astro
// initializes, by astro.config.mjs. Getters preserve request-time server reads.
export function createServerEnv(source: ServerEnv) {
  return {
    get API_PROXY_TARGET() {
      return source.API_PROXY_TARGET;
    },
    get SERVER_API_URL() {
      const proxy = source.API_PROXY_TARGET?.replace(/\/$/, "");
      if (proxy) return `${proxy}/functions/v1/api/v1`;
      const configured = source.PUBLIC_API_URL ?? DEFAULT_SERVER_API_URL;
      if (/^https?:\/\//.test(configured)) return configured.replace(/\/$/, "");
      return DEFAULT_SERVER_API_URL;
    },
  };
}

export const env = createServerEnv(process.env);
