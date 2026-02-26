// path: lib/r2.ts
import { S3Client } from "@aws-sdk/client-s3";

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export const R2_BUCKET = must("R2_BUCKET");
export const R2_PUBLIC_BASE_URL = must("R2_PUBLIC_BASE_URL").replace(/\/+$/, "");

export function getR2Client() {
  const accountId = must("R2_ACCOUNT_ID");
  const accessKeyId = must("R2_ACCESS_KEY_ID");
  const secretAccessKey = must("R2_SECRET_ACCESS_KEY");

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true, // R2 建議打開
  });
}