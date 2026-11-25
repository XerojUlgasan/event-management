export const r2Fixture = {
  S3_API_URL: "https://test.r2.cloudflarestorage.com",
  R2_ACCESS_KEY_ID: "fixture-key",
  R2_SECRET_ACCESS_KEY: "fixture-secret",
  R2_BUCKET_NAME: "test",
  R2_SUPPORTING_DOCUMENTS_BUCKET_NAME: "test-documents",
  R2_OBJECT_PREFIX: undefined,
};

export function localR2Fetch(origin: string): typeof fetch {
  const originalFetch = globalThis.fetch;

  return async (input, init) => {
    if (!(input instanceof Request)) return originalFetch(input, init);

    const url = new URL(input.url);
    if (url.origin !== r2Fixture.S3_API_URL) return originalFetch(input, init);

    return originalFetch(new URL(url.pathname, origin), {
      method: input.method,
      headers: input.headers,
      body: input.body ? await input.arrayBuffer() : undefined,
      signal: input.signal,
    });
  };
}
