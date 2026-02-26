// path: app/api/admin/posts/[id]/media/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertActive, assertAdmin } from "@/lib/rbac";

type MediaItemInput = {
  url: string;
  type?: string; // default "IMAGE"
  sortOrder?: number;
};

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

const MAX_FILES_PER_POST = 5;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await ctx.params;

  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  const body = await req.json().catch(() => ({}));
  const itemsRaw = Array.isArray(body?.items) ? body.items : [];
  const items: MediaItemInput[] = itemsRaw
    .map((x: any) => ({
      url: String(x?.url ?? "").trim(),
      type: String(x?.type ?? "IMAGE").trim(),
      sortOrder:
        typeof x?.sortOrder === "number" && Number.isFinite(x.sortOrder)
          ? x.sortOrder
          : 0,
    }))
    .filter((x) => !!x.url);

  if (items.length === 0) {
    return NextResponse.json({ error: "NO_ITEMS" }, { status: 400 });
  }

  // ensure post exists + not deleted
  const post = await prisma.post.findFirst({
    where: { id: postId, deletedAt: null },
    select: { id: true },
  });
  if (!post) {
    return NextResponse.json({ error: "POST_NOT_FOUND" }, { status: 404 });
  }

  // count existing images
  const existingCount = await prisma.postMedia.count({
    where: { postId },
  });

  if (existingCount >= MAX_FILES_PER_POST) {
    return NextResponse.json({ error: "MEDIA_LIMIT_REACHED" }, { status: 400 });
  }

  if (existingCount + items.length > MAX_FILES_PER_POST) {
    return NextResponse.json(
      {
        error: "TOO_MANY_FILES",
        detail: `max=${MAX_FILES_PER_POST} existing=${existingCount} incoming=${items.length}`,
      },
      { status: 400 }
    );
  }

  // only allow IMAGE in phase 1
  const badType = items.find((x) => String(x.type).toUpperCase() !== "IMAGE");
  if (badType) {
    return NextResponse.json({ error: "ONLY_IMAGE_ALLOWED" }, { status: 400 });
  }

  await prisma.postMedia.createMany({
    data: items.map((it) => ({
      postId,
      type: "IMAGE",
      url: it.url,
      sortOrder: it.sortOrder ?? 0,
    })),
  });

  revalidatePath("/");
  revalidatePath(`/post/${postId}`);
  revalidatePath("/admin/posts");
  revalidatePath(`/admin/posts/${postId}/edit`);

  return NextResponse.json({ ok: true });
}