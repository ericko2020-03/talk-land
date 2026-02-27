// path: app/admin/posts/[id]/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertAdmin, assertActive } from "@/lib/rbac";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ParamsLike = { id?: string } | Promise<{ id?: string }>;

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

function visibilityBadge(vRaw: string) {
  const v = String(vRaw ?? "").toUpperCase();
  if (v === "PUBLIC") return { label: "公開", icon: "🌍" };
  if (v === "LOGIN_ONLY") return { label: "會員", icon: "👥" };
  if (v === "ADMIN_ONLY") return { label: "封鎖（僅 Admin）", icon: "🔒" };
  if (v === "ADMIN_DRAFT") return { label: "草稿（僅 Admin）", icon: "📝" };
  return { label: v || "UNKNOWN", icon: "❓" };
}

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

export default async function AdminPostPreviewPage({
  params,
}: {
  params: ParamsLike;
}) {
  const resolved = await Promise.resolve(params as any);
  const id = String(resolved?.id ?? "").trim();
  if (!id) redirect("/admin/posts");

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect(
      `/api/auth/signin?callbackUrl=${encodeURIComponent(`/admin/posts/${id}`)}`
    );
  }

  const role = (session.user as any).role;
  const status = (session.user as any).status;

  try {
    assertActive(status);
    assertAdmin(role);
  } catch {
    redirect("/");
  }

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
    },
  });

  // ✅ 後台視覺：卡片外黑底白字 + 內容白卡（不做手機/桌機區分）
  const pageShell = "space-y-6 bg-black text-white rounded";
  const topLink = "underline text-white hover:text-white/80";
  const metaText = "text-neutral-600";
  const metaLink = "hover:underline hover:text-neutral-900";

  if (!post) {
    return (
      <div className={pageShell}>
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">後台｜查看貼文</h1>

          <nav className="flex items-center gap-4 text-sm">
            <Link className={topLink} href="/admin/posts">
              回文章列表
            </Link>
          </nav>
        </header>

        <div className="rounded border bg-white text-neutral-900 p-4">
          找不到貼文或已刪除
        </div>
      </div>
    );
  }

  const vb = visibilityBadge(String(post.visibility));
  const embedUrl = getYouTubeEmbedUrl(post.youtubeUrl);

  const images = (post.media ?? []).filter((m: any) => {
    const t = String(m?.type ?? "").toUpperCase();
    const u = String(m?.url ?? "").trim();
    if (!u) return false;
    return t === "IMAGE" || looksLikeImageUrl(u);
  });

  const contentTrimmed = String(post.content ?? "").trim();

  return (
    <div className={pageShell}>
      {/* ✅ Header：結構比照前台單篇頁，但保留後台功能 */}
      <header className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h1 className="text-2xl font-bold">後台｜查看貼文</h1>
          <div className="text-sm text-white/70">
            ID：<span className="font-mono text-white/90">{post.id}</span>
          </div>
        </div>

        <nav className="flex items-center gap-4 text-sm">
          <Link className={topLink} href="/admin/posts">
            回文章列表
          </Link>
          <Link className={topLink} href={`/admin/posts/${post.id}/edit`}>
            編輯
          </Link>
          <Link className={topLink} href={`/post/${post.id}`} title="一般使用者視角">
            前台查看
          </Link>
        </nav>
      </header>

      {/* ✅ 文章卡片：白底黑字（比照前台） */}
      <article className="rounded border bg-white text-neutral-900 p-4 space-y-4">
        {/* top meta row */}
        <div className={`text-sm ${metaText} flex flex-wrap items-center gap-2`}>
          <span>
            {post.author?.name ?? post.author?.email ?? "Unknown"} ·{" "}
            {new Date(post.createdAt).toLocaleString("zh-TW")}
          </span>

          <span
            className="rounded border px-2 py-0.5 text-xs bg-neutral-50 text-neutral-700"
            title={vb.label}
          >
            {vb.icon} {vb.label}
          </span>
        </div>

        {/* content */}
        {contentTrimmed.length > 0 ? (
          <div className="whitespace-pre-wrap">{post.content}</div>
        ) : (
          <div className="text-sm text-neutral-500">(無文字內容)</div>
        )}

        {/* images */}
        {images.length > 0 ? (
          <div className="flex flex-col items-center gap-4">
            {images.map((m: any) => (
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

        {/* youtube */}
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
            className={`text-sm underline ${metaLink}`}
            href={post.youtubeUrl}
            target="_blank"
            rel="noreferrer"
          >
            YouTube 連結（外開）
          </a>
        ) : null}

        {/* ✅ icon row：移到左下角，距離同前台 */}
        <div className="pt-3 border-t border-neutral-200/70">
          <div className={`flex items-center justify-between text-sm ${metaText}`}>
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1" title="留言數">
                💬 <span>{post._count.comments}</span>
              </span>

              <span className="inline-flex items-center gap-1" title="按讚數">
                ❤️ <span>{post._count.likes}</span>
              </span>

              <span className="inline-flex items-center gap-1" title="附件 / 媒體數量">
                📎 <span>{post._count.media}</span>
              </span>
            </div>

            <span className="text-neutral-400 select-none"> </span>
          </div>
        </div>
      </article>

      {/* ✅ 留言區：白卡（比照前台） */}
      <section className="space-y-3">
        <h2 className="font-semibold text-white">留言</h2>

        {post.comments.length === 0 ? (
          <div className="rounded border bg-white text-neutral-900 p-4">
            <div className="text-neutral-500">目前還沒有留言。</div>
          </div>
        ) : (
          <div className="rounded border bg-white text-neutral-900 p-4 space-y-3">
            {post.comments.map((c: any) => (
              <div key={c.id} className="rounded border p-3">
                <div className="text-sm text-neutral-500">
                  {c.author?.name ?? c.author?.email ?? "Unknown"} ·{" "}
                  {new Date(c.createdAt).toLocaleString("zh-TW")}
                </div>
                <div className="whitespace-pre-wrap">{c.content}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}