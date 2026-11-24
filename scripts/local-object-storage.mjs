export const localEdgeS3Endpoint = "http://kong:8000/storage/v1/s3";

export function localObjectStorageEnvironment(status) {
  const api = new URL(status.API_URL);
  const endpoint = new URL(status.STORAGE_S3_URL);

  if (
    api.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(api.hostname) ||
    endpoint.origin !== api.origin ||
    endpoint.pathname !== "/storage/v1/s3" ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    !status.S3_PROTOCOL_ACCESS_KEY_ID ||
    !status.S3_PROTOCOL_ACCESS_KEY_SECRET ||
    !status.S3_PROTOCOL_REGION
  )
    throw new Error("Supabase did not report local S3 storage credentials.");

  return {
    R2_ENDPOINT: endpoint.href,
    R2_ACCESS_KEY_ID: status.S3_PROTOCOL_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: status.S3_PROTOCOL_ACCESS_KEY_SECRET,
    R2_REGION: status.S3_PROTOCOL_REGION,
    R2_BUCKET_NAME: "event-management",
    R2_DOCUMENTS_BUCKET_NAME: "supporting-documents",
  };
}
