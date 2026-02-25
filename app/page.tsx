// path: app/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  const posts = await prisma.post.findMany({
    where: { deletedAt: null, visibility: "PUBLIC" },
    orderBy: { createdAt: "desc" },
    include: {
      author: true,
      _count: { select: { comments: true, likes: true, media: true } },
    },
    take: 50,
  });

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Allensay_s 社群</h1>
        <nav className="flex items-center gap-4 text-sm">
          <Link className="underline" href="/api/auth/signin?callbackUrl=/">
            登入
          </Link>
          <Link className="underline" href="/admin/posts/new">
            後台發文
          </Link>
        </nav>
      </header>

      <section className="space-y-4">
        {posts.length === 0 ? (
          <div className="text-neutral-500">目前還沒有公開貼文。</div>
        ) : (
          posts.map((p) => (
            <article key={p.id} className="rounded border p-4 space-y-2">
              <div className="text-sm text-neutral-500">
                {p.author?.name ?? p.author?.email ?? "Unknown"} ·{" "}
                {new Date(p.createdAt).toLocaleString("zh-TW")}
                {" · "}💬 {p._count.comments}
                {" · "}❤️ {p._count.likes}
                {" · "}🖼️ {p._count.media}
              </div>

              <div className="whitespace-pre-wrap">{p.content}</div>

              <div className="flex items-center gap-4 text-sm">
                <Link className="underline" href={`/post/${p.id}`}>
                  查看留言
                </Link>

                {p.youtubeUrl ? (
                  <a className="underline" href={p.youtubeUrl} target="_blank" rel="noreferrer">
                    YouTube 連結
                  </a>
                ) : null}
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}