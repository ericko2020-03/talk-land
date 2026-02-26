// path: app/api/admin/posts/draft/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertAdmin, assertActive } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

function isEmptyDraftCandidate(p: { content: string; youtubeUrl: string | null }) {
  const contentEmpty = (p.content ?? "").trim().length === 0;
  const ytEmpty = !String(p.youtubeUrl ?? "").trim();
  return contentEmpty && ytEmpty;
}

export async function POST() {
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

  // ✅ 先找「最新的空白草稿」：同一個 admin，在同一段時間內只會拿到同一張空白草稿
  const existing = await prisma.post.findFirst({
    where: {
      authorId,
      deletedAt: null,
      visibility: "ADMIN_DRAFT",
      // content / youtube 空
      content: "",
      youtubeUrl: null,
      // 且沒有任何 media
      media: { none: {} },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, content: true, youtubeUrl: true },
  });

  if (existing && isEmptyDraftCandidate(existing)) {
    return NextResponse.json({ id: existing.id, reused: true }, { status: 200 });
  }

  // ✅ 沒有才建立
  const created = await prisma.post.create({
    data: {
      authorId,
      content: "",
      youtubeUrl: null,
      visibility: "ADMIN_DRAFT",
    },
    select: { id: true },
  });

  revalidatePath("/admin/posts");
  revalidatePath("/admin/posts/new");

  return NextResponse.json({ id: created.id, reused: false }, { status: 201 });
}