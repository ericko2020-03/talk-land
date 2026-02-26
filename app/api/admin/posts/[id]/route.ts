// path: app/api/admin/posts/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertAdmin, assertActive } from "@/lib/rbac";

type Visibility = "PUBLIC" | "LOGIN_ONLY";

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

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  const body = await req.json().catch(() => ({}));
  const content = String(body?.content ?? "").trim();
  const youtubeUrl = body?.youtubeUrl ? String(body.youtubeUrl).trim() : null;
  const visibility = (body?.visibility ?? "PUBLIC") as Visibility;

  if (!content) {
    return NextResponse.json({ error: "EMPTY_CONTENT" }, { status: 400 });
  }
  if (visibility !== "PUBLIC" && visibility !== "LOGIN_ONLY") {
    return NextResponse.json({ error: "BAD_VISIBILITY" }, { status: 400 });
  }

  // Guard: prevent Prisma update throw (missing / soft-deleted)
  const exists = await prisma.post.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const post = await prisma.post.update({
    where: { id },
    data: { content, youtubeUrl, visibility },
    select: { id: true, content: true, youtubeUrl: true, visibility: true },
  });

  revalidatePath("/");
  revalidatePath(`/post/${id}`);
  revalidatePath("/admin/posts");
  revalidatePath(`/admin/posts/${id}/edit`);

  return NextResponse.json({ ok: true, post });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  // Guard: prevent Prisma update throw (missing / soft-deleted)
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