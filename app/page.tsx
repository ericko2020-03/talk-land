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

function getYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();

    // youtu.be/<id>
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id ? id : null;
    }

    // youtube.com/*
    if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      // /watch?v=<id>
      if (u.pathname === "/watch") {
        const id = u.searchParams.get("v");
        return id ? id : null;
      }

      // /shorts/<id>
      if (u.pathname.startsWith("/shorts/")) {
        const id = u.pathname.split("/").filter(Boolean)[1];
        return id ? id : null;
      }

      // /embed/<id>
      if (u.pathname.startsWith("/embed/")) {
        const id = u.pathname.split("/").filter(Boolean)[1];
        return id ? id : null;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function getYouTubeEmbedUrl(youtubeUrl?: string | null): string | null {
  if (!youtubeUrl) return null;
  const id = getYouTubeVideoId(youtubeUrl);
  if (!id) return null;
  // nocookie + modestbranding 讓嵌入較乾淨
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(
    id
  )}?rel=0&modestbranding=1`;
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
            <Link className="underline" href={`/api/auth/signin?callbackUrl=${encodeURIComponent("/")}`}>
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
          <div className="text-neutral-500">
            目前還沒有{signedIn ? "貼文" : "公開貼文"}。
          </div>
        ) : (
          posts.map((p) => {
            const likedByMe = signedIn ? (p as any).likes?.length > 0 : false;
            const embedUrl = getYouTubeEmbedUrl(p.youtubeUrl);

            return (
              <article key={p.id} className="rounded border p-4 space-y-3">
                {/* Author + time as primary navigation entry */}
                <Link
                  href={`/post/${p.id}`}
                  className="block text-sm text-neutral-500 hover:underline"
                >
                  {p.author?.name ?? p.author?.email ?? "Unknown"} ·{" "}
                  {new Date(p.createdAt).toLocaleString("zh-TW")} ·{" "}
                  <span title={p.visibility}>
                    {visibilityIcon(p.visibility as any)}
                  </span>
                </Link>

                {/* Content preview: clamp to 5 lines */}
                <div
                  className="whitespace-pre-wrap"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 5,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {p.content}
                </div>

                {/* YouTube embed (if present) */}
                {embedUrl ? (
                  <div className="rounded border overflow-hidden">
                    <div
                      className="relative w-full"
                      style={{ paddingTop: "56.25%" }}
                    >
                      <iframe
                        className="absolute inset-0 h-full w-full"
                        src={embedUrl}
                        title="YouTube video"
                        loading="lazy"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </div>
                  </div>
                ) : null}

                {/* CTA */}
                <div className="text-sm">
                  <Link
                    href={`/post/${p.id}`}
                    className="text-neutral-700 hover:underline"
                  >
                    查看全文與留言 →
                  </Link>
                </div>

                {/* Icon row: avoid always-on underline to remove the stray line */}
                <div className="flex items-center gap-4 text-sm">
                  <Link
                    href={`/post/${p.id}`}
                    className="inline-flex items-center gap-1 text-neutral-700 hover:underline"
                  >
                    💬 <span className="text-neutral-600">{p._count.comments}</span>
                  </Link>

                  <LikeButton
                    postId={p.id}
                    signedIn={signedIn}
                    initialLiked={likedByMe}
                    initialCount={p._count.likes}
                  />

                  <span
                    className="inline-flex items-center gap-1"
                    title="附件 / 媒體數量"
                  >
                    📎 <span className="text-neutral-600">{p._count.media}</span>
                  </span>

                  {p.youtubeUrl ? (
                    <a
                      className="text-neutral-700 hover:underline"
                      href={p.youtubeUrl}
                      target="_blank"
                      rel="noreferrer"
                      title="YouTube 外開"
                    >
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