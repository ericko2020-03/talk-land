import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import { r2 } from "@/lib/r2";

export const runtime = "nodejs"; // 重要：AWS SDK 在 Node runtime 最穩

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
      return NextResponse.json({ error: "Unsupported file type" }, { status: 415 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 413 });
    }

    const ext = mimeToExt(file.type);
    const key = `uploads/${yyyyMMdd()}/${crypto.randomUUID()}${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const body = Buffer.from(arrayBuffer);

    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: key,
        Body: body,
        ContentType: file.type,
        // 這是 HTTP cache header（選配）
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    const publicUrl = `${process.env.R2_PUBLIC_BASE_URL}/${key}`;

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
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    default:
      return "";
  }
}
function yyyyMMdd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}