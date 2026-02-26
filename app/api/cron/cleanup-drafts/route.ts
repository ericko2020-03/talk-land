// path: app/api/cron/cleanup-drafts/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function requireCronAuth(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: true as const }; // 若你暫時不設 secret（不建議），就放行
  const got = req.headers.get("x-cron-secret") ?? "";
  if (got !== secret) return { ok: false as const };
  return { ok: true as const };
}

export async function GET(req: Request) {
  const auth = requireCronAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "UNAUTHORIZED_CRON" }, { status: 401 });
  }

  const now = new Date();

  // 只刪：過期、仍是草稿、且內容/連結/圖片都空
  // 注意：Prisma relation filter：media: { none: {} }
  const result = await prisma.post.deleteMany({
    where: {
      deletedAt: null,
      visibility: "ADMIN_DRAFT",
      draftExpiresAt: { lte: now },
      content: "",
      youtubeUrl: null,
      media: { none: {} },
    },
  });

  return NextResponse.json({ ok: true, deleted: result.count, now: now.toISOString() });
}