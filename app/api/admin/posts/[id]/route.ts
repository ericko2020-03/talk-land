// path: app/api/admin/posts/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertAdmin, assertActive } from "@/lib/rbac";

type Visibility = "PUBLIC" | "LOGIN_ONLY" | "ADMIN_ONLY" | "ADMIN_DRAFT";

async function requireAdmin() {
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

  return { ok: true as const };
}

function normalizeYoutubeUrl(input: unknown) {
  const s = String(input ?? "").trim();
  return s.length > 0 ? s : null;
}

function isValidVisibility(v: string): v is Visibility {
  return v === "PUBLIC" || v === "LOGIN_ONLY" || v === "ADMIN_ONLY" || v === "ADMIN_DRAFT";
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  const body = await req.json().catch(() => ({}));
  const contentRaw = String(body?.content ?? "");
  const content = contentRaw.trimEnd();
  const youtubeUrl = normalizeYoutubeUrl(body?.youtubeUrl);
  const visibility = String(body?.visibility ?? "PUBLIC").toUpperCase();

  if (!isValidVisibility(visibility)) {
    return NextResponse.json({ error: "BAD_VISIBILITY" }, { status: 400 });
  }

  // 取現況（避免 update 到不存在）
  const existing = await prisma.post.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, visibility: true, publishedAt: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const trimmed = String(content ?? "").trim();
  const mediaCount = await prisma.postMedia.count({ where: { postId: id } });

  // ✅ 規則：
  // - ADMIN_DRAFT：允許空文字/空圖
  // - 其他 visibility：必須「有文字」或「有圖」
  if (visibility !== "ADMIN_DRAFT") {
    if (trimmed.length === 0 && mediaCount === 0) {
      return NextResponse.json({ error: "EMPTY_CONTENT_AND_NO_MEDIA" }, { status: 400 });
    }
  }

  const isPublishingToUserFacing = visibility === "PUBLIC" || visibility === "LOGIN_ONLY";
  const wasDraft = existing.visibility === "ADMIN_DRAFT";
  const willClearDraftTtl = visibility !== "ADMIN_DRAFT";

  const post = await prisma.post.update({
    where: { id },
    data: {
      content,
      youtubeUrl,
      visibility: visibility as any,
      // ✅ 只要不是草稿就清 TTL（避免被 cron 清掉）
      draftExpiresAt: willClearDraftTtl ? null : undefined,
      // ✅ 從草稿轉成 PUBLIC/LOGIN_ONLY 時，寫入 publishedAt（第一次即可）
      publishedAt:
        wasDraft && isPublishingToUserFacing && !existing.publishedAt ? new Date() : undefined,
    },
    select: { id: true, content: true, youtubeUrl: true, visibility: true, draftExpiresAt: true, publishedAt: true },
  });

  revalidatePath("/");
  revalidatePath(`/post/${id}`);
  revalidatePath("/admin/posts");
  revalidatePath(`/admin/posts/${id}/edit`);
  revalidatePath("/admin/posts/new");

  return NextResponse.json({ ok: true, post });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  const exists = await prisma.post.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const post = await prisma.post.update({
    where: { id },
    data: { deletedAt: new Date() },
    select: { id: true },
  });

  revalidatePath("/");
  revalidatePath(`/post/${id}`);
  revalidatePath("/admin/posts");

  return NextResponse.json({ ok: true, id: post.id });
}