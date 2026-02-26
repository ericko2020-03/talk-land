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

      if (u.pathname.startsWith("/shorts/")) {
        const id = u.pathname.split("/").filter(Boolean)[1];
        return id || null;
      }

      if (u.pathname.startsWith("/embed/")) {
        const id = u.pathname.split("/").filter(Boolean)[1];
        return id || null;
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

function isLikelyImageUrl(url: string) {
  const s = (url ?? "").toLowerCase().split("?")[0].split("#")[0];
  return (
    s.endsWith(".jpg") ||
    s.endsWith(".jpeg") ||
    s.endsWith(".png") ||
    s.endsWith(".webp") ||
    s.endsWith(".gif")
  );
}

export default async function PostPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const session = await getServerSession(authOptions);
  const signedIn = !!session?.user;
  const userId = signedIn ? String((session!.user as any).id) : null;

  const post = await prisma.post.findFirst({
    where: { id, deletedAt: null },
    include: {
      author: true,
      media: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
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

  if (post.visibility === "LOGIN_ONLY" && !signedIn) {
    return (
      <main className="mx-auto max-w-2xl p-6 space-y-4">
        <div className="text-neutral-700">此貼文僅登入可見。</div>
        <Link
          className="underline"
          href={`/api/auth/signin?callbackUrl=${encodeURIComponent(
            `/post/${post.id}`
          )}`}
        >
          登入後查看
        </Link>
        <Link className="underline" href="/">
          回首頁
        </Link>
      </main>
    );
  }

  const likedByMe = signedIn ? (post.likes?.length ?? 0) > 0 : false;
  const embedUrl = getYouTubeEmbedUrl(post.youtubeUrl);

  // ✅ 兼容：type=IMAGE 或 URL 看起來就是圖片 → 都顯示
  const images = (post.media ?? []).filter((m) => {
    const t = String((m as any)?.type ?? "").toUpperCase();
    const u = String((m as any)?.url ?? "").trim();
    if (!u) return false;
    if (t === "IMAGE") return true;
    return isLikelyImageUrl(u);
  });

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <Link className="underline" href="/">
          ← 回首頁
        </Link>

        <div className="flex items-center gap-3 text-sm text-neutral-600">
          <span>💬 {post._count.comments}</span>

          <LikeButton
            postId={post.id}
            signedIn={signedIn}
            initialLiked={likedByMe}
            initialCount={post._count.likes}
          />

          <span>📎 {post._count.media}</span>
        </div>
      </header>

      <article className="rounded border p-4 space-y-4">
        <div className="text-sm text-neutral-500">
          {post.author?.name ?? post.author?.email ?? "Unknown"} ·{" "}
          {new Date(post.createdAt).toLocaleString("zh-TW")}
          {" · "}
          {post.visibility}
        </div>

        <div className="whitespace-pre-wrap">{post.content}</div>

        {/* ✅ 圖片附件區塊 */}
        {images.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {images.map((m: any) => (
              <div key={m.id} className="rounded border overflow-hidden">
                <img
                  src={m.url}
                  alt="post image"
                  className="w-full h-auto block"
                  loading="lazy"
                />
              </div>
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
          <a
            className="text-sm underline"
            href={post.youtubeUrl}
            target="_blank"
            rel="noreferrer"
          >
            YouTube 連結（外開）
          </a>
        ) : null}
      </article>

      <section className="space-y-3">
        <h2 className="font-semibold">留言</h2>

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
      </section>
    </main>
  );
}