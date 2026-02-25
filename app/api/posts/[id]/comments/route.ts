// path: app/api/posts/[id]/comments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { assertActive } from "@/lib/rbac";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: postId } = await ctx.params;

  const comments = await prisma.comment.findMany({
    where: { postId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: { author: true },
    take: 200,
  });

  return NextResponse.json(comments);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: postId } = await ctx.params;

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const status = (session.user as any).status;
  try {
    assertActive(status);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "FORBIDDEN" },
      { status: e?.statusCode ?? 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const content = String(body?.content ?? "").trim();
  if (!content) {
    return NextResponse.json({ error: "EMPTY_CONTENT" }, { status: 400 });
  }

  const post = await prisma.post.findFirst({
    where: { id: postId, deletedAt: null },
    select: { id: true, visibility: true },
  });
  if (!post) {
    return NextResponse.json({ error: "POST_NOT_FOUND" }, { status: 404 });
  }

  // LOGIN_ONLY：已登入才可能走到 POST，所以 OK

  const comment = await prisma.comment.create({
    data: {
      postId,
      authorId: (session.user as any).id,
      content,
    },
    include: { author: true },
  });

  // Invalidate pages that show comment counts
  revalidatePath("/");
  revalidatePath(`/post/${postId}`);

  return NextResponse.json(comment);
}