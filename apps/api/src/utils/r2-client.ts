import { S3Client } from "@aws-sdk/client-s3";

export function r2Config() {
  const names = ["R2_BUCKET_NAME", "R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"] as const;
  const missing = names.filter(name => !process.env[name]?.trim());
  if (missing.length) throw new Error(`Missing R2 configuration: ${missing.join(", ")}`);

  return {
    bucket: process.env.R2_BUCKET_NAME!,
    client: new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT!,
      // R2 does not support the SDK's default PutObject CRC32 checksum.
      requestChecksumCalculation: "WHEN_REQUIRED",
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    }),
  };
}
