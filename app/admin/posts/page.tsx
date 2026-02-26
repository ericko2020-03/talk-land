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

function previewText(content: string, n = 120) {
  const s = (content ?? "").replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

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

      // ✅ 隱藏「空白草稿」：
      // visibility=ADMIN_DRAFT 且 content="" 且 youtube=null 且 media=0
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
      _count: { select: { comments: true, likes: true, media: true } },
    },
    take: 200,
  };

  const posts: PostAdminItem[] = await prisma.post.findMany(query);

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6 bg-white text-neutral-900 min-h-screen">
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

      <section className="space-y-3">
        {posts.length === 0 ? (
          <div className="text-neutral-500">目前沒有貼文。</div>
        ) : (
          <AdminPostsListClient
            posts={posts.map((p) => ({
              id: p.id,
              createdAt: p.createdAt.toISOString(),
              visibility: String(p.visibility),
              authorLabel: p.author?.name ?? p.author?.email ?? "Unknown",
              preview: previewText(p.content, 140),
              countComments: p._count.comments,
              countLikes: p._count.likes,
              countMedia: p._count.media,
            }))}
          />
        )}
      </section>
    </main>
  );
}