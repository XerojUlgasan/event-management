import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { uploadImageToR2 } from "../src/utils/upload-image-to-r2.js";

test("uploads valid images with a unique category key and validates input and configuration", async () => {
  const names = ["R2_BUCKET_NAME", "R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"] as const;
  const previous = names.map(name => process.env[name]);
  const send = mock.method(S3Client.prototype, "send", async () => ({} as never));
  try {
    const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: "#aabbcc" } }).png().toBuffer();
    const jpeg = await sharp(png).jpeg().toBuffer();
    for (const name of names) delete process.env[name];
    await assert.rejects(uploadImageToR2("venues", png, "image/png"), /Missing R2 configuration: R2_BUCKET_NAME, R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY/);
    Object.assign(process.env, { R2_BUCKET_NAME: "test-bucket", R2_ENDPOINT: "https://example.r2.cloudflarestorage.com", R2_ACCESS_KEY_ID: "test-key", R2_SECRET_ACCESS_KEY: "test-secret" });
    await assert.rejects(uploadImageToR2("venues", jpeg, "image/png"), /valid JPEG or PNG/);
    await assert.rejects(uploadImageToR2("venues", Buffer.alloc(10 * 1024 * 1024 + 1), "image/png"), /up to 10 MiB/);
    await assert.rejects(uploadImageToR2("venues", jpeg.subarray(0, 3), "image/jpeg"), /valid JPEG or PNG/);
    assert.equal(send.mock.callCount(), 0);

    const max = Buffer.alloc(10 * 1024 * 1024);
    png.copy(max);
    await uploadImageToR2("venues", max, "image/png");
    send.mock.resetCalls();

    const first = await uploadImageToR2("venues", png, "image/png");
    const second = await uploadImageToR2("venues", png, "image/png");
    const third = await uploadImageToR2("services", jpeg, "image/jpeg");
    const fourth = await uploadImageToR2("packages", png, "image/png");
    assert.match(first, /^venues\/[0-9a-f-]{36}\.png$/);
    assert.notEqual(first, second);
    assert.match(third, /^services\/[0-9a-f-]{36}\.jpg$/);
    assert.match(fourth, /^packages\/[0-9a-f-]{36}\.png$/);
    const command = send.mock.calls[0].arguments[0] as PutObjectCommand;
    assert.ok(command instanceof PutObjectCommand);
    assert.deepEqual(command.input, { Bucket: "test-bucket", Key: first, Body: png, ContentType: "image/png" });
  } finally {
    names.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    });
    send.mock.restore();
  }
});
