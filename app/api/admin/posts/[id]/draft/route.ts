// path: app/api/admin/posts/[id]/draft/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertAdmin, assertActive } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const role = (session.user as any).role;
  const status = (session.user as any).status;

  try {
    assertActive(status);
    assertAdmin(role);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "FORBIDDEN" }, { status: e?.statusCode ?? 403 });
  }

  const authorId = String((session.user as any).id);

  // 只允許刪除「自己」的空白草稿
  const post = await prisma.post.findFirst({
    where: {
      id,
      authorId,
      deletedAt: null,
    },
    include: { media: { select: { id: true }, take: 1 } },
  });

  if (!post) return NextResponse.json({ ok: true, skipped: "NOT_FOUND" }, { status: 200 });

  const contentEmpty = (post.content ?? "").trim().length === 0;
  const ytEmpty = !String(post.youtubeUrl ?? "").trim();
  const hasMedia = (post.media?.length ?? 0) > 0;

  // ✅ 僅刪除：visibility=ADMIN_DRAFT 且 (content空 && youtube空 && 無media)
  if (post.visibility !== "ADMIN_DRAFT" || !contentEmpty || !ytEmpty || hasMedia) {
    return NextResponse.json({ ok: true, skipped: "NOT_EMPTY_DRAFT" }, { status: 200 });
  }

  await prisma.post.delete({ where: { id: post.id } });

  revalidatePath("/admin/posts");
  revalidatePath("/admin/posts/new");

  return NextResponse.json({ ok: true, deleted: true }, { status: 200 });
}