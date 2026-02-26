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
  return u.endsWith(".jpg") || u.endsWith(".jpeg") || u.endsWith(".png") || u.endsWith(".webp") || u.endsWith(".gif");
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

export default async function AdminPostPreviewPage({ params }: { params: ParamsLike }) {
  const resolved = await Promise.resolve(params as any);
  const id = String(resolved?.id ?? "").trim();
  if (!id) redirect("/admin/posts");

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(`/admin/posts/${id}`)}`);
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

  if (!post) {
    return (
      <main className="mx-auto max-w-2xl p-6 space-y-4 bg-white text-neutral-900 min-h-screen">
        <div>找不到貼文或已刪除</div>
        <Link className="underline" href="/admin/posts">
          回文章列表
        </Link>
      </main>
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
    <main className="mx-auto max-w-2xl p-6 space-y-6 bg-white text-neutral-900 min-h-screen">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">後台查看貼文</h1>
          <div className="text-sm text-neutral-600">
            ID：<span className="font-mono">{post.id}</span>
          </div>
        </div>

        <nav className="flex items-center gap-4 text-sm">
          <Link className="underline" href="/admin/posts">
            回文章列表
          </Link>
          <Link className="underline" href={`/admin/posts/${post.id}/edit`}>
            編輯
          </Link>
          <Link className="underline" href={`/post/${post.id}`} title="一般使用者視角">
            前台查看
          </Link>
        </nav>
      </header>

      <article className="rounded border p-4 space-y-4">
        <div className="text-sm text-neutral-500 flex flex-wrap items-center gap-2">
          <span>
            {post.author?.name ?? post.author?.email ?? "Unknown"} · {new Date(post.createdAt).toLocaleString("zh-TW")}
          </span>

          <span className="rounded border px-2 py-0.5 text-xs bg-neutral-50" title={vb.label}>
            {vb.icon} {vb.label}
          </span>

          <span>💬 {post._count.comments}</span>
          <span>❤️ {post._count.likes}</span>
          <span>🖼️ {post._count.media}</span>
        </div>

        {/* 內容（允許空白：顯示 placeholder） */}
        {contentTrimmed.length > 0 ? (
          <div className="whitespace-pre-wrap">{post.content}</div>
        ) : (
          <div className="text-sm text-neutral-500">(無文字內容)</div>
        )}

        {/* 圖片：一律水平置中，垂直排列；手機寬度內縮放 */}
        {images.length > 0 ? (
          <div className="space-y-3">
            {images.map((m: any) => (
              <div key={m.id} className="flex justify-center">
                <img
                  src={m.url}
                  alt="post image"
                  className="h-auto max-w-full w-auto"
                  style={{ display: "block" }}
                />
              </div>
            ))}
          </div>
        ) : null}

        {/* YouTube（如果有） */}
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

        {post.comments.length === 0 ? (
          <div className="text-neutral-500">目前還沒有留言。</div>
        ) : (
          <div className="space-y-3">
            {post.comments.map((c: any) => (
              <div key={c.id} className="rounded border p-3">
                <div className="text-sm text-neutral-500">
                  {c.author?.name ?? c.author?.email ?? "Unknown"} · {new Date(c.createdAt).toLocaleString("zh-TW")}
                </div>
                <div className="whitespace-pre-wrap">{c.content}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}