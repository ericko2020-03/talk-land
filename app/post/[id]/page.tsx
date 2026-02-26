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
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/").filter(Boolean)[1] || null;
      if (u.pathname.startsWith("/embed/")) return u.pathname.split("/").filter(Boolean)[1] || null;
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
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1`;
}

function looksLikeImageUrl(url: string) {
  const u = url.toLowerCase();
  return u.endsWith(".jpg") || u.endsWith(".jpeg") || u.endsWith(".png") || u.endsWith(".webp") || u.endsWith(".gif");
}

function visibilityIcon(v: string) {
  const vv = String(v || "").toUpperCase();
  if (vv === "PUBLIC") return { icon: "🌍", title: "公開" };
  if (vv === "LOGIN_ONLY") return { icon: "👥", title: "會員" };
  if (vv === "ADMIN_ONLY") return { icon: "🔒", title: "封鎖（僅 Admin）" };
  if (vv === "ADMIN_DRAFT") return { icon: "📝", title: "草稿（僅 Admin）" };
  return { icon: "❓", title: vv || "UNKNOWN" };
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // 這裡暫時維持你的寫法；JWT_SESSION_ERROR 我們下一輪再一起收斂
  const session = await getServerSession(authOptions);
  const signedIn = !!session?.user;
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
            likes: { where: { userId: userId! }, select: { userId: true }, take: 1 },
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

  // 會員可見：未登入則擋
  if (post.visibility === "LOGIN_ONLY" && !signedIn) {
    return (
      <main className="mx-auto max-w-2xl p-6 space-y-4">
        <div className="text-neutral-700">此貼文僅會員可見。</div>
        <Link
          className="underline"
          href={`/api/auth/signin?callbackUrl=${encodeURIComponent(`/post/${post.id}`)}`}
        >
          登入後查看
        </Link>
        <Link className="underline" href="/">
          回首頁
        </Link>
      </main>
    );
  }

  // ADMIN_ONLY / ADMIN_DRAFT：前台一律不顯示
  if (post.visibility === "ADMIN_ONLY" || post.visibility === "ADMIN_DRAFT") {
    return (
      <main className="mx-auto max-w-2xl p-6 space-y-4">
        <div className="text-neutral-700">找不到貼文</div>
        <Link className="underline" href="/">
          回首頁
        </Link>
      </main>
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
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <Link className="underline" href="/">
          ← 回首頁
        </Link>

        <div className="flex items-center gap-3 text-sm text-neutral-600">
          <span>💬 {post._count.comments}</span>

          <LikeButton postId={post.id} signedIn={signedIn} initialLiked={likedByMe} initialCount={post._count.likes} />

          <span>📎 {post._count.media}</span>
        </div>
      </header>

      <article className="rounded border p-4 space-y-4">
        <div className="text-sm text-neutral-500 flex items-center gap-2">
          <span>
            {post.author?.name ?? post.author?.email ?? "Unknown"} · {new Date(post.createdAt).toLocaleString("zh-TW")}
          </span>

          <span title={vis.title} aria-label={vis.title} className="select-none">
            {vis.icon}
          </span>
        </div>

        <div className="whitespace-pre-wrap">{post.content}</div>

        {/* ✅ 圖片規則：
            1) 一律水平置中
            2) 多張由上到下垂直排列
            3) 若原圖寬 < 容器 → 維持原寬；否則縮到容器寬，鎖定比例
           實作：img 設 maxWidth:100% + width:auto + height:auto
        */}
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

        {/* YouTube embed（單篇頁照常顯示，不影響列表規則） */}
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
          <a className="text-sm underline" href={post.youtubeUrl} target="_blank" rel="noreferrer">
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
                  {c.author?.name ?? c.author?.email ?? "Unknown"} · {new Date(c.createdAt).toLocaleString("zh-TW")}
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