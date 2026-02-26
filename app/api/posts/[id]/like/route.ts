// path: app/api/posts/[id]/like/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { assertActive } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

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

  const post = await prisma.post.findFirst({
    where: { id: postId, deletedAt: null },
    select: { id: true },
  });
  if (!post) {
    return NextResponse.json({ error: "POST_NOT_FOUND" }, { status: 404 });
  }

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const existing = await tx.postLike.findUnique({
      where: { postId_userId: { postId, userId } },
      select: { postId: true },
    });

    let liked: boolean;

    if (existing) {
      await tx.postLike.delete({ where: { postId_userId: { postId, userId } } });
      liked = false;
    } else {
      await tx.postLike.create({ data: { postId, userId } });
      liked = true;
    }

    const count = await tx.postLike.count({ where: { postId } });
    return { liked, count };
  });

  revalidatePath("/");
  revalidatePath(`/post/${postId}`);
  revalidatePath("/admin/posts");

  return NextResponse.json({ ok: true, ...result });
}