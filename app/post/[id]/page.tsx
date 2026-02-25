// path: app/post/[id]/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import CommentForm from "./CommentForm";

type PostDetail = Awaited<ReturnType<typeof prisma.post.findFirst>>;
type CommentItem = NonNullable<PostDetail>["comments"][number];

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  const post: PostDetail = await prisma.post.findFirst({
    where: { id, deletedAt: null },
    include: {
      author: true,
      comments: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: { author: true },
        take: 200,
      },
      _count: { select: { likes: true, comments: true, media: true } },
    },
  });

  if (!post) {
    return (
      <main className="mx-auto max-w-2xl p-6 space-y-4">
        <div>找不到貼文</div>
        <Link className="underline" href="/">
          回首頁
        </Link>
      </main>
    );
  }

  if (post.visibility === "LOGIN_ONLY" && !session?.user) {
    return (
      <main className="mx-auto max-w-2xl p-6 space-y-4">
        <div className="text-neutral-700">此貼文僅登入可見。</div>
        <Link className="underline" href={`/api/auth/signin?callbackUrl=/post/${post.id}`}>
          登入後查看
        </Link>
        <Link className="underline" href="/">
          回首頁
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <Link className="underline" href="/">
          ← 回首頁
        </Link>
        <div className="text-sm text-neutral-500">
          💬 {post._count.comments} · ❤️ {post._count.likes} · 🖼️ {post._count.media}
        </div>
      </header>

      <article className="rounded border p-4 space-y-2">
        <div className="text-sm text-neutral-500">
          {post.author?.name ?? post.author?.email ?? "Unknown"} ·{" "}
          {new Date(post.createdAt).toLocaleString("zh-TW")}
          {" · "}
          {post.visibility}
        </div>

        <div className="whitespace-pre-wrap">{post.content}</div>

        {post.youtubeUrl ? (
          <a className="text-sm underline" href={post.youtubeUrl} target="_blank" rel="noreferrer">
            YouTube 連結
          </a>
        ) : null}
      </article>

      <section className="space-y-3">
        <h2 className="font-semibold">留言</h2>

        <CommentForm postId={post.id} signedIn={!!session?.user} />

        <div className="space-y-3">
          {post.comments.length === 0 ? (
            <div className="text-neutral-500">目前還沒有留言。</div>
          ) : (
            post.comments.map((c: CommentItem) => (
              <div key={c.id} className="rounded border p-3">
                <div className="text-sm text-neutral-500">
                  {c.author?.name ?? c.author?.email ?? "Unknown"} ·{" "}
                  {new Date(c.createdAt).toLocaleString("zh-TW")}
                </div>
                <div className="whitespace-pre-wrap">{c.content}</div>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}