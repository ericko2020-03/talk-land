// path: app/api/admin/posts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertAdmin, assertActive } from "@/lib/rbac";

export async function POST(req: NextRequest) {
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
    return NextResponse.json(
      { error: e?.message ?? "FORBIDDEN" },
      { status: e?.statusCode ?? 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const content = String(body?.content ?? "").trim();
  const youtubeUrl = body?.youtubeUrl ? String(body.youtubeUrl).trim() : null;
  const visibility = (body?.visibility ?? "PUBLIC") as "PUBLIC" | "LOGIN_ONLY";

  if (!content) {
    return NextResponse.json({ error: "EMPTY_CONTENT" }, { status: 400 });
  }
  if (visibility !== "PUBLIC" && visibility !== "LOGIN_ONLY") {
    return NextResponse.json({ error: "BAD_VISIBILITY" }, { status: 400 });
  }

  const post = await prisma.post.create({
    data: {
      authorId: (session.user as any).id,
      content,
      youtubeUrl,
      visibility,
    },
  });

  // Invalidate cached pages after mutation
  // - Home feed
  revalidatePath("/");
  // - Post detail page
  revalidatePath(`/post/${post.id}`);

  return NextResponse.json(post);
}