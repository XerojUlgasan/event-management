import { mock } from "node:test";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export function installR2ImageStoreMock() {
  const names = ["R2_BUCKET_NAME", "R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"] as const;
  const previous = names.map(name => process.env[name]);
  Object.assign(process.env, {
    R2_BUCKET_NAME: "test-images",
    R2_ENDPOINT: "https://example.r2.cloudflarestorage.com",
    R2_ACCESS_KEY_ID: "test-key",
    R2_SECRET_ACCESS_KEY: "test-secret",
  });
  const objects = new Map<string, Buffer>();
  const send = mock.method(S3Client.prototype, "send", async (command: unknown) => {
    if (command instanceof PutObjectCommand) {
      objects.set(command.input.Key!, Buffer.from(command.input.Body as Buffer));
      return {} as never;
    }
    if (command instanceof GetObjectCommand) {
      const body = objects.get(command.input.Key!);
      if (!body) throw Object.assign(new Error("NoSuchKey"), { $metadata: { httpStatusCode: 404 } });
      return { Body: { transformToByteArray: async () => body } } as never;
    }
    if (command instanceof DeleteObjectCommand) {
      objects.delete(command.input.Key!);
      return {} as never;
    }
    throw new Error("Unexpected R2 command");
  });
  return {
    objects,
    restore() {
      send.mock.restore();
      names.forEach((name, index) => {
        if (previous[index] === undefined) delete process.env[name];
        else process.env[name] = previous[index];
      });
    },
  };
}
