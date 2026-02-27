// path: app/post/[id]/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import CommentForm from "./CommentForm";
import LikeButton from "@/app/components/LikeButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PostWithRelations = Awaited<ReturnType<typeof prisma.post.findFirst>>;
type CommentItem = NonNullable<PostWithRelations>["comments"][number];

type MediaItem = {
  id: string;
  url: string;
  type?: string | null;
};

function getYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id || null;
    }

    if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      if (u.pathname.startsWith("/shorts/"))
        return u.pathname.split("/").filter(Boolean)[1] || null;
      if (u.pathname.startsWith("/embed/"))
        return u.pathname.split("/").filter(Boolean)[1] || null;
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
  const u = url.toLowerCase();
  return (
    u.endsWith(".jpg") ||
    u.endsWith(".jpeg") ||
    u.endsWith(".png") ||
    u.endsWith(".webp") ||
    u.endsWith(".gif")
  );
}

function visibilityIcon(v: string) {
  const vv = String(v || "").toUpperCase();
  if (vv === "PUBLIC") return { icon: "🌍", title: "公開" };
  if (vv === "LOGIN_ONLY") return { icon: "👥", title: "會員" };
  if (vv === "ADMIN_ONLY") return { icon: "🔒", title: "封鎖（僅 Admin）" };
  if (vv === "ADMIN_DRAFT") return { icon: "📝", title: "草稿（僅 Admin）" };
  return { icon: "❓", title: vv || "UNKNOWN" };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  const signedIn = !!session?.user;
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const userId = signedIn ? String((session!.user as any).id) : null;

  const post = await prisma.post.findFirst({
    where: { id, deletedAt: null },
    include: {
      author: true,
      media: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      comments: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: { author: true },
        take: 200,
      },
      _count: { select: { likes: true, comments: true, media: true } },
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
  });

  const topLink =
    "underline text-white hover:text-white/80 sm:text-neutral-900 sm:hover:text-neutral-700";

  // ✅ 外層（僅手機）黑底白字；桌機回白底系統
  const pageShell =
    "space-y-6 bg-black text-white sm:bg-transparent sm:text-neutral-900";

  // ✅ 卡片內固定白底 → meta 用白底灰階
  const metaText = "text-neutral-600";
  const metaLink = "hover:underline hover:text-neutral-900";

  if (!post) {
    return (
      <div className={pageShell}>
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white sm:text-neutral-900">
            Allensay_s 社群
          </h1>
          <nav className="flex items-center gap-4 text-sm">
            {signedIn ? (
              <Link className={topLink} href="/api/auth/signout?callbackUrl=/">
                登出
              </Link>
            ) : (
              <Link
                className={topLink}
                href={`/api/auth/signin?callbackUrl=${encodeURIComponent("/")}`}
              >
                登入
              </Link>
            )}

            {isAdmin ? (
              <Link className={topLink} href="/admin/posts">
                後台管理
              </Link>
            ) : null}

            <Link className={topLink} href="/">
              回首頁
            </Link>
          </nav>
        </header>

        <div className="rounded border bg-white text-neutral-900 p-4">
          找不到貼文
        </div>
      </div>
    );
  }

  // 會員可見：未登入則擋
  if (post.visibility === "LOGIN_ONLY" && !signedIn) {
    return (
      <div className={pageShell}>
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white sm:text-neutral-900">
            Allensay_s 社群
          </h1>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              className={topLink}
              href={`/api/auth/signin?callbackUrl=${encodeURIComponent(
                `/post/${post.id}`
              )}`}
            >
              登入
            </Link>

            {isAdmin ? (
              <Link className={topLink} href="/admin/posts">
                後台管理
              </Link>
            ) : null}

            <Link className={topLink} href="/">
              回首頁
            </Link>
          </nav>
        </header>

        <div className="rounded border bg-white text-neutral-900 p-4 space-y-3">
          <div className="text-neutral-700">此貼文僅會員可見。</div>
          <Link
            className="underline"
            href={`/api/auth/signin?callbackUrl=${encodeURIComponent(
              `/post/${post.id}`
            )}`}
          >
            登入後查看
          </Link>
        </div>
      </div>
    );
  }

  // ADMIN_ONLY / ADMIN_DRAFT：前台一律不顯示
  if (post.visibility === "ADMIN_ONLY" || post.visibility === "ADMIN_DRAFT") {
    return (
      <div className={pageShell}>
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white sm:text-neutral-900">
            Allensay_s 社群
          </h1>
          <nav className="flex items-center gap-4 text-sm">
            {signedIn ? (
              <Link className={topLink} href="/api/auth/signout?callbackUrl=/">
                登出
              </Link>
            ) : (
              <Link
                className={topLink}
                href={`/api/auth/signin?callbackUrl=${encodeURIComponent("/")}`}
              >
                登入
              </Link>
            )}

            {isAdmin ? (
              <Link className={topLink} href="/admin/posts">
                後台管理
              </Link>
            ) : null}

            <Link className={topLink} href="/">
              回首頁
            </Link>
          </nav>
        </header>

        <div className="rounded border bg-white text-neutral-900 p-4">
          找不到貼文
        </div>
      </div>
    );
  }

  const likedByMe = signedIn ? (post.likes?.length ?? 0) > 0 : false;
  const embedUrl = getYouTubeEmbedUrl(post.youtubeUrl);

  const images: MediaItem[] = (post.media ?? []).filter((m: any) => {
    const t = String(m?.type ?? "").toUpperCase();
    const u = String(m?.url ?? "").trim();
    if (!u) return false;
    return t === "IMAGE" || looksLikeImageUrl(u);
  });

  const vis = visibilityIcon(String(post.visibility));

  return (
    <div className={pageShell}>
      {/* ✅ Header 與首頁一致：標題 + auth/admin + 回首頁靠右 */}
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white sm:text-neutral-900">
          Allensay_s 社群
        </h1>

        <nav className="flex items-center gap-4 text-sm">
          {signedIn ? (
            <Link className={topLink} href="/api/auth/signout?callbackUrl=/">
              登出
            </Link>
          ) : (
            <Link
              className={topLink}
              href={`/api/auth/signin?callbackUrl=${encodeURIComponent(
                `/post/${post.id}`
              )}`}
            >
              登入
            </Link>
          )}

          {isAdmin ? (
            <Link className={topLink} href="/admin/posts">
              後台管理
            </Link>
          ) : null}

          <Link className={topLink} href="/">
            回首頁
          </Link>
        </nav>
      </header>

      {/* ✅ 卡片內白底黑字（與首頁一致） */}
      <article className="rounded border bg-white text-neutral-900 p-4 space-y-4">
        <div className={`text-sm ${metaText} flex items-center gap-2`}>
          <span>
            {post.author?.name ?? post.author?.email ?? "Unknown"} ·{" "}
            {new Date(post.createdAt).toLocaleString("zh-TW")}
          </span>

          <span title={vis.title} aria-label={vis.title} className="select-none">
            {vis.icon}
          </span>
        </div>

        <div className="whitespace-pre-wrap">{post.content}</div>

        {/* 圖片：水平置中、垂直排列、max-w-full */}
        {images.length > 0 ? (
          <div className="flex flex-col items-center gap-4">
            {images.map((m) => (
              <figure key={m.id} className="w-full flex justify-center">
                <img
                  src={m.url}
                  alt="post image"
                  className="block max-w-full h-auto rounded border"
                />
              </figure>
            ))}
          </div>
        ) : null}

        {/* YouTube embed */}
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
        ) : null}

        {post.youtubeUrl ? (
          <a className={`text-sm underline ${metaLink}`} href={post.youtubeUrl} target="_blank" rel="noreferrer">
            YouTube 連結（外開）
          </a>
        ) : null}

        {/* ✅ 愛心一列：移到文章左下角，距離/樣式同首頁 */}
        <div className="pt-3 border-t border-neutral-200/70">
          <div className={`flex items-center justify-between text-sm ${metaText}`}>
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1" title="留言數">
                💬 <span>{post._count.comments}</span>
              </span>

              <LikeButton
                postId={post.id}
                signedIn={signedIn}
                initialLiked={likedByMe}
                initialCount={post._count.likes}
              />

              <span className="inline-flex items-center gap-1" title="附件 / 媒體數量">
                📎 <span>{post._count.media}</span>
              </span>
            </div>

            {/* 單篇頁右側留白（避免再放 CTA） */}
            <span className="text-neutral-400 select-none"> </span>
          </div>
        </div>
      </article>

      {/* 留言區（保持白底卡片風格，避免黑底上直接放白字） */}
      <section className="space-y-3">
        <h2 className="font-semibold text-white sm:text-neutral-900">留言</h2>

        <div className="rounded border bg-white text-neutral-900 p-4 space-y-4">
          <CommentForm postId={post.id} signedIn={signedIn} />

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
        </div>
      </section>
    </div>
  );
}