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

function visibilityIcon(v: string) {
  const vv = String(v || "").toUpperCase();
  if (vv === "PUBLIC") return { icon: "🌍", title: "公開" };
  if (vv === "LOGIN_ONLY") return { icon: "👥", title: "會員" };
  if (vv === "ADMIN_ONLY") return { icon: "🔒", title: "封鎖（僅 Admin）" };
  if (vv === "ADMIN_DRAFT") return { icon: "📝", title: "草稿（僅 Admin）" };
  return { icon: "❓", title: vv || "UNKNOWN" };
}

function getYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id ? id : null;
    }

    if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      if (u.pathname === "/watch") {
        const id = u.searchParams.get("v");
        return id ? id : null;
      }
      if (u.pathname.startsWith("/shorts/")) {
        const id = u.pathname.split("/").filter(Boolean)[1];
        return id ? id : null;
      }
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
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(
    id
  )}?rel=0&modestbranding=1`;
}

function looksLikeImageUrl(url: string) {
  const u = String(url || "").toLowerCase();
  return (
    u.endsWith(".jpg") ||
    u.endsWith(".jpeg") ||
    u.endsWith(".png") ||
    u.endsWith(".webp") ||
    u.endsWith(".gif")
  );
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
      media: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, url: true, type: true },
        take: 1,
      },
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

  // ✅ 卡片內固定白底 → meta 直接用白底灰階（不依賴 dark）
  const metaText = "text-neutral-600";
  const metaLink = "hover:underline hover:text-neutral-900";

  return (
    // ✅ 外圍黑底白字（先只做首頁，不改全站）
    <div className="space-y-6 bg-black text-white rounded">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Allensay_s 社群</h1>

        <nav className="flex items-center gap-4 text-sm">
          {signedIn ? (
            <Link className="underline" href="/api/auth/signout?callbackUrl=/">
              登出
            </Link>
          ) : (
            <Link
              className="underline"
              href={`/api/auth/signin?callbackUrl=${encodeURIComponent("/")}`}
            >
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
          <div className="text-neutral-300">
            目前還沒有{signedIn ? "貼文" : "公開貼文"}。
          </div>
        ) : (
          posts.map((p) => {
            const likedByMe = signedIn ? (p as any).likes?.length > 0 : false;
            const embedUrl = getYouTubeEmbedUrl(p.youtubeUrl);

            const mediaFirst: any = Array.isArray((p as any).media)
              ? (p as any).media[0]
              : null;

            const firstImageUrl =
              !embedUrl && mediaFirst
                ? (() => {
                    const t = String(mediaFirst?.type ?? "").toUpperCase();
                    const u = String(mediaFirst?.url ?? "").trim();
                    if (!u) return null;
                    if (t === "IMAGE" || looksLikeImageUrl(u)) return u;
                    return null;
                  })()
                : null;

            const vis = visibilityIcon(String((p as any).visibility));

            return (
              // ✅ 卡片固定白底黑字
              <article key={p.id} className="rounded border bg-white text-neutral-900 p-4 space-y-3">
                <Link
                  href={`/post/${p.id}`}
                  className={`block text-sm ${metaText} ${metaLink}`}
                >
                  {p.author?.name ?? p.author?.email ?? "Unknown"} ·{" "}
                  {new Date(p.createdAt).toLocaleString("zh-TW")} ·{" "}
                  <span
                    title={vis.title}
                    aria-label={vis.title}
                    className="select-none"
                  >
                    {vis.icon}
                  </span>
                </Link>

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

                {embedUrl ? (
                  <div className="rounded border overflow-hidden">
                    <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
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
                ) : firstImageUrl ? (
                  <div className="flex justify-center">
                    <img
                      src={firstImageUrl}
                      alt="post cover"
                      className="block max-w-full h-auto rounded border"
                    />
                  </div>
                ) : null}

                <div className="pt-3 border-t border-neutral-200/70">
                  <div className={`flex items-center justify-between text-sm ${metaText}`}>
                    <div className="flex items-center gap-4">
                      <Link
                        href={`/post/${p.id}`}
                        className={`inline-flex items-center gap-1 ${metaLink}`}
                        aria-label="查看留言"
                      >
                        💬 <span>{p._count.comments}</span>
                      </Link>

                      <LikeButton
                        postId={p.id}
                        signedIn={signedIn}
                        initialLiked={likedByMe}
                        initialCount={p._count.likes}
                      />

                      <span className="inline-flex items-center gap-1" title="附件 / 媒體數量">
                        📎 <span>{p._count.media}</span>
                      </span>

                      {p.youtubeUrl ? (
                        <a
                          className={`${metaLink}`}
                          href={p.youtubeUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="YouTube 外開"
                        >
                          YouTube
                        </a>
                      ) : null}
                    </div>

                    <Link
                      href={`/post/${p.id}`}
                      className={`inline-flex items-center gap-1 font-medium ${metaLink}`}
                      aria-label="查看全文與留言"
                    >
                      查看全文與留言 →
                    </Link>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}