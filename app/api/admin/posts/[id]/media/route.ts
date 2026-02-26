// path: app/api/admin/posts/[id]/media/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertActive, assertAdmin } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

const MAX_FILES = 5;

type IncomingItem = {
  url: string;
  type?: string; // default IMAGE
  sortOrder?: number;
};

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { ok: false as const, res: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
  }

  const role = (session.user as any).role;
  const status = (session.user as any).status;

  try {
    assertActive(status);
    assertAdmin(role);
  } catch (e: any) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: e?.message ?? "FORBIDDEN" }, { status: e?.statusCode ?? 403 }),
    };
  }

  return { ok: true as const, session };
}

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const { id: postId } = ctx.params;

  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  const body = await req.json().catch(() => ({}));
  const items = (body?.items ?? []) as IncomingItem[];
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "EMPTY_ITEMS" }, { status: 400 });
  }

  // check post exists
  const post = await prisma.post.findFirst({
    where: { id: postId, deletedAt: null },
    select: {
      id: true,
      media: { select: { id: true, type: true } },
    },
  });
  if (!post) return NextResponse.json({ error: "POST_NOT_FOUND" }, { status: 404 });

  const existingImages = post.media.filter((m) => String(m.type || "").toUpperCase() === "IMAGE").length;
  if (existingImages >= MAX_FILES) {
    return NextResponse.json({ error: "MEDIA_LIMIT_REACHED" }, { status: 400 });
  }

  const normalized = items.map((it, idx) => ({
    url: String(it.url || "").trim(),
    type: String(it.type || "IMAGE").toUpperCase(),
    sortOrder: Number.isFinite(it.sortOrder as any) ? Number(it.sortOrder) : existingImages + idx,
  }));

  const bad = normalized.find((x) => !x.url || x.type !== "IMAGE");
  if (bad) return NextResponse.json({ error: "BAD_ITEM" }, { status: 400 });

  if (existingImages + normalized.length > MAX_FILES) {
    return NextResponse.json({ error: "TOO_MANY_FILES" }, { status: 400 });
  }

  await prisma.postMedia.createMany({
    data: normalized.map((x) => ({
      postId,
      url: x.url,
      type: x.type,
      sortOrder: x.sortOrder,
    })),
  });

  revalidatePath("/");
  revalidatePath(`/post/${postId}`);
  revalidatePath(`/admin/posts/${postId}/edit`);
  revalidatePath("/admin/posts");

  return NextResponse.json({ ok: true });
}