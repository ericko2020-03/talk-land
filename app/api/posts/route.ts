// path: app/api/posts/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const posts = await prisma.post.findMany({
    where: { deletedAt: null, visibility: "PUBLIC" },
    orderBy: { createdAt: "desc" },
    include: {
      author: true,
      _count: {
        select: { comments: true, likes: true, media: true },
      },
    },
    take: 50,
  });

  return NextResponse.json(posts);
}