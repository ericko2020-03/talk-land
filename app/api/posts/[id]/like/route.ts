// path: app/api/posts/[id]/like/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { assertActive } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: postId } = await ctx.params;

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const status = (session.user as any).status;
  try {
    assertActive(status);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "FORBIDDEN" }, { status: e?.statusCode ?? 403 });
  }

  const userId = String((session.user as any).id);

  // ensure post exists + not deleted
  const post = await prisma.post.findFirst({
    where: { id: postId, deletedAt: null },
    select: { id: true },
  });
  if (!post) {
    return NextResponse.json({ error: "POST_NOT_FOUND" }, { status: 404 });
  }

  const existing = await prisma.postLike.findUnique({
    where: { postId_userId: { postId, userId } },
    select: { postId: true },
  });

  let liked: boolean;

  if (existing) {
    await prisma.postLike.delete({
      where: { postId_userId: { postId, userId } },
    });
    liked = false;
  } else {
    await prisma.postLike.create({
      data: { postId, userId },
    });
    liked = true;
  }

  const count = await prisma.postLike.count({ where: { postId } });

  // keep pages fresh
  revalidatePath("/");
  revalidatePath(`/post/${postId}`);

  return NextResponse.json({ ok: true, liked, count });
}