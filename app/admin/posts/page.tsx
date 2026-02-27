// path: app/admin/posts/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertAdmin, assertActive } from "@/lib/rbac";
import AdminPostsListClient from "./AdminPostsListClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PostsQuery = Parameters<typeof prisma.post.findMany>[0];
type PostAdminItem = Awaited<ReturnType<typeof prisma.post.findMany>>[number];

export default async function AdminPostsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/api/auth/signin?callbackUrl=/admin/posts");
  }

  const role = (session.user as any).role;
  const status = (session.user as any).status;

  try {
    assertActive(status);
    assertAdmin(role);
  } catch {
    redirect("/");
  }

  const query: PostsQuery = {
    where: {
      deletedAt: null,
      NOT: {
        visibility: "ADMIN_DRAFT",
        content: "",
        youtubeUrl: null,
        media: { none: {} },
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      author: true,
      media: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, url: true, type: true },
        take: 1,
      },
      _count: { select: { comments: true, likes: true, media: true } },
    },
    take: 200,
  };

  const posts: PostAdminItem[] = await prisma.post.findMany(query);

  return (
    <div className="space-y-6 bg-white text-neutral-900 min-h-screen">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">後台｜文章管理</h1>
        <nav className="flex items-center gap-4 text-sm">
          <Link className="underline" href="/">
            回首頁
          </Link>
          <Link className="underline" href="/admin/posts/new">
            新增貼文
          </Link>
        </nav>
      </header>

      <section className="space-y-4">
        {posts.length === 0 ? (
          <div className="text-neutral-500">目前沒有貼文。</div>
        ) : (
          <AdminPostsListClient
            posts={posts.map((p) => {
              const mediaFirst: any = Array.isArray((p as any).media)
                ? (p as any).media[0]
                : null;

              return {
                id: p.id,
                createdAt: p.createdAt.toISOString(),
                visibility: String((p as any).visibility),
                authorLabel: p.author?.name ?? p.author?.email ?? "Unknown",
                content: String(p.content ?? ""),
                youtubeUrl: (p as any).youtubeUrl ? String((p as any).youtubeUrl) : null,
                mediaFirstUrl: mediaFirst?.url ? String(mediaFirst.url) : null,
                mediaFirstType: mediaFirst?.type ? String(mediaFirst.type) : null,
                countComments: p._count.comments,
                countLikes: p._count.likes,
                countMedia: p._count.media,
              };
            })}
          />
        )}
      </section>
    </div>
  );
}