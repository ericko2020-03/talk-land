// path: app/api/uploads/r2/presign/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { assertActive, assertAdmin } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_PREFIX = "image/";

async function requireAdminSession() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }),
    };
  }

  const role = (session.user as any).role;
  const status = (session.user as any).status;

  try {
    assertActive(status);
    assertAdmin(role);
  } catch (e: any) {
    return {
      ok: false as const,
      res: NextResponse.json(
        { error: e?.message ?? "FORBIDDEN" },
        { status: e?.statusCode ?? 403 }
      ),
    };
  }

  return { ok: true as const, session };
}

function extFromContentType(ct: string) {
  const s = String(ct || "").toLowerCase();
  if (s === "image/jpeg") return "jpg";
  if (s === "image/png") return "png";
  if (s === "image/webp") return "webp";
  if (s === "image/gif") return "gif";
  return "bin";
}

function safeSlugFilename(name: string) {
  return String(name || "file")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function s3() {
  const accountId = process.env.R2_ACCOUNT_ID!;
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminSession();
  if (!guard.ok) return guard.res;

  const body = await req.json().catch(() => ({}));
  const postId = String(body?.postId ?? "").trim();
  const filename = String(body?.filename ?? "").trim();
  const contentType = String(body?.contentType ?? "").trim();
  const size = Number(body?.size ?? 0);

  if (!postId) return NextResponse.json({ error: "MISSING_POST_ID" }, { status: 400 });
  if (!filename) return NextResponse.json({ error: "MISSING_FILENAME" }, { status: 400 });

  // ✅ 先確認 post 存在（避免 ghost upload）
  const post = await prisma.post.findFirst({
    where: { id: postId, deletedAt: null },
    select: { id: true },
  });
  if (!post) {
    return NextResponse.json({ error: "POST_NOT_FOUND" }, { status: 404 });
  }

  if (!contentType || !contentType.startsWith(ALLOWED_PREFIX)) {
    return NextResponse.json({ error: "ONLY_IMAGE_ALLOWED" }, { status: 400 });
  }

  if (!Number.isFinite(size) || size <= 0 || size > MAX_SIZE) {
    return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 400 });
  }

  const bucket = process.env.R2_BUCKET!;
  const publicBase = process.env.R2_PUBLIC_BASE_URL!;
  if (!bucket || !publicBase) {
    return NextResponse.json({ error: "R2_ENV_NOT_SET" }, { status: 500 });
  }

  const ext = extFromContentType(contentType);
  const safeName = safeSlugFilename(filename);
  const key = `posts/${postId}/${Date.now()}-${safeName}.${ext}`;

  const client = s3();
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  });

  const uploadUrl = await getSignedUrl(client, cmd, { expiresIn: 60 });
  const publicUrl = `${publicBase.replace(/\/$/, "")}/${key}`;

  return NextResponse.json({ ok: true, uploadUrl, publicUrl, key });
}