import { AwsClient } from "aws4fetch";
import { config } from "../env.js";

export function getR2Storage(bucketOverride?: string) {
  if (bucketOverride && bucketOverride !== "supporting-documents") return;

  const endpoint = config.S3_API_URL?.trim();
  const accessKeyId = config.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = config.R2_SECRET_ACCESS_KEY?.trim();
  const mediaBucket = config.R2_BUCKET_NAME?.trim();
  const documentBucket = config.R2_SUPPORTING_DOCUMENTS_BUCKET_NAME?.trim();
  const prefix = config.R2_OBJECT_PREFIX?.trim();

  if (
    ![
      endpoint,
      accessKeyId,
      secretAccessKey,
      mediaBucket,
      documentBucket,
      prefix,
    ].some(Boolean)
  )
    return;

  const bucket = bucketOverride ? documentBucket : mediaBucket;

  // Supporting PDFs are an independent bucket and can switch over later.
  if (bucketOverride && !bucket) return;

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket)
    throw new Error(
      "R2 storage is missing endpoint, credentials, or bucket configuration",
    );

  const url = URL.parse(endpoint);

  if (
    !url ||
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".r2.cloudflarestorage.com") ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error(
      "S3_API_URL must be the HTTPS R2 account endpoint without a bucket path",
    );

  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket))
    throw new Error("Invalid R2 bucket name");

  if (prefix && !/^[\w-]+(?:\/[\w-]+)*$/.test(prefix))
    throw new Error("Invalid R2 object prefix");

  const client = new AwsClient({
    accessKeyId,
    secretAccessKey,
    region: "auto",
    service: "s3",
  });

  return {
    async request(key: string, init: RequestInit) {
      const path = [bucket, ...(prefix?.split("/") ?? []), ...key.split("/")]
        .map(encodeURIComponent)
        .join("/");
      const request = await client.sign(`${url.origin}/${path}`, {
        ...init,
        redirect: "error",
      });

      return fetch(request);
    },
  };
}
