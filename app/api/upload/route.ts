// path: app/api/upload/route.ts
import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import { getR2Client, getR2Bucket, getR2PublicBaseUrl } from "@/lib/r2";

export const runtime = "nodejs";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 415 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File too large (max 5MB)" },
        { status: 413 }
      );
    }

    const client = getR2Client();
    const bucket = getR2Bucket();
    const publicBase = getR2PublicBaseUrl();

    const ext = mimeToExt(file.type);
    const key = `uploads/${yyyyMMdd()}/${crypto.randomUUID()}${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const body = Buffer.from(arrayBuffer);

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: file.type,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    const publicUrl = `${publicBase}/${key}`;
    return NextResponse.json({ key, publicUrl });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Upload failed", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

function mimeToExt(mime: string) {
  switch (mime) {
    case "image/jpeg":
      return ".jpeg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    default:
      throw new Error(`Unsupported MIME type: ${mime}`);
  }
}

function yyyyMMdd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}