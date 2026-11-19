/** Keep the configured API mount, including a Supabase function prefix. */
export function messageImageUrl(url: string, apiBase: string) {
  return url.startsWith("/v1/")
    ? `${apiBase.replace(/\/$/, "")}${url.slice(3)}`
    : url;
}
