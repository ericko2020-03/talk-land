// path: app/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import LikeButton from "@/app/components/LikeButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PostsQuery = Parameters<typeof prisma.post.findMany>[0];
type PostFeedItem = Awaited<ReturnType<typeof prisma.post.findMany>>[number];

function visibilityIcon(v: "PUBLIC" | "LOGIN_ONLY") {
  return v === "PUBLIC" ? "🌍" : "👥";
}

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const signedIn = !!session?.user;
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const userId = signedIn ? String((session!.user as any).id) : null;

  const query: PostsQuery = {
    where: {
      deletedAt: null,
      visibility: signedIn ? { in: ["PUBLIC", "LOGIN_ONLY"] } : "PUBLIC",
    },
    orderBy: { createdAt: "desc" },
    include: {
      author: true,
      _count: { select: { comments: true, likes: true, media: true } },
      ...(signedIn
        ? {
            likes: {
              where: { userId: userId! },
              select: { userId: true },
              take: 1,
            },
          }
        : {}),
    },
    take: 50,
  };

  const posts: PostFeedItem[] = await prisma.post.findMany(query);

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Allensay_s 社群</h1>

        <nav className="flex items-center gap-4 text-sm">
          {signedIn ? (
            <Link className="underline" href="/api/auth/signout?callbackUrl=/">
              登出
            </Link>
          ) : (
            <Link className="underline" href="/api/auth/signin?callbackUrl=/">
              登入
            </Link>
          )}

          {isAdmin ? (
            <Link className="underline" href="/admin/posts">
              後台管理
            </Link>
          ) : null}
        </nav>
      </header>

      <section className="space-y-4">
        {posts.length === 0 ? (
          <div className="text-neutral-500">目前還沒有{signedIn ? "貼文" : "公開貼文"}。</div>
        ) : (
          posts.map((p) => {
            const likedByMe = signedIn ? (p as any).likes?.length > 0 : false;

            return (
              <article key={p.id} className="rounded border p-4 space-y-2">
                <div className="text-sm text-neutral-500">
                  {p.author?.name ?? p.author?.email ?? "Unknown"} ·{" "}
                  {new Date(p.createdAt).toLocaleString("zh-TW")}
                </div>

                <div className="whitespace-pre-wrap">{p.content}</div>

                <div className="flex items-center gap-4 text-sm">
                  <Link className="underline" href={`/post/${p.id}`}>
                    💬 <span className="text-neutral-600">{p._count.comments}</span>
                  </Link>

                  <LikeButton
                    postId={p.id}
                    signedIn={signedIn}
                    initialLiked={likedByMe}
                    initialCount={p._count.likes}
                  />

                  {/* 媒體/附件：目前代表 PostMedia 數量 */}
                  <span className="inline-flex items-center gap-1" title="附件 / 媒體數量">
                    📎 <span className="text-neutral-600">{p._count.media}</span>
                  </span>

                  {/* 可見性 icon */}
                  <span className="inline-flex items-center gap-1" title={p.visibility}>
                    {visibilityIcon(p.visibility as any)}
                  </span>

                  {p.youtubeUrl ? (
                    <a className="underline" href={p.youtubeUrl} target="_blank" rel="noreferrer">
                      YouTube
                    </a>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}