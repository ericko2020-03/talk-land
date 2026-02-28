// path: app/admin/posts/AdminPostsListClient.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import DeletePostButton from "./DeletePostButton";

type PostRow = {
  id: string;
  createdAt: string;
  visibility: string;
  authorLabel: string;

  content: string;
  youtubeUrl: string | null;

  mediaFirstUrl: string | null;
  mediaFirstType: string | null;

  countComments: number;
  countLikes: number;
  countMedia: number;
};

function visibilityBadge(vRaw: string) {
  const v = String(vRaw ?? "").toUpperCase();
  if (v === "PUBLIC") return { label: "公開", icon: "🌍" };
  if (v === "LOGIN_ONLY") return { label: "會員", icon: "👥" };
  if (v === "ADMIN_ONLY") return { label: "封鎖", icon: "🔒" };
  if (v === "ADMIN_DRAFT") return { label: "草稿", icon: "📝" };
  return { label: v || "UNKNOWN", icon: "❓" };
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

// ✅ deterministic formatter: avoid toLocaleString() hydration mismatch
function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function formatZhTwDateTime(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();

  const hh = d.getHours();
  const mm = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());

  const ampm = hh < 12 ? "上午" : "下午";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;

  // format: 2026/3/1 上午2:42:33  (no locale-dependent spaces)
  return `${y}/${m}/${day} ${ampm}${h12}:${mm}:${ss}`;
}

export default function AdminPostsListClient({ posts }: { posts: PostRow[] }) {
  const router = useRouter();

  // 後台固定白底：用一致灰階即可
  const metaText = "text-neutral-600";
  const metaLink = "hover:underline hover:text-neutral-900";

  return (
    <div className="as-card-stack">
      {posts.map((p) => {
        const adminViewHref = `/admin/posts/${p.id}`; // 後台查看（可看草稿/封鎖）
        const editHref = `/admin/posts/${p.id}/edit`;
        const viewHref = `/post/${p.id}`;
        const vb = visibilityBadge(p.visibility);

        const embedUrl = getYouTubeEmbedUrl(p.youtubeUrl);

        // 列表媒體規則（與首頁一致）：
        // - 有 YouTube：顯示影片（即使有圖也不展示 cover）
        // - 無 YouTube：若第一張媒體看起來是圖 → 顯示第一張
        const firstImageUrl =
          !embedUrl && p.mediaFirstUrl
            ? (() => {
                const t = String(p.mediaFirstType ?? "").toUpperCase();
                const u = String(p.mediaFirstUrl ?? "").trim();
                if (!u) return null;
                if (t === "IMAGE" || looksLikeImageUrl(u)) return u;
                return null;
              })()
            : null;

        const content = String(p.content ?? "");

        return (
          <article key={p.id} className="as-card as-card-pad w-full space-y-3">
            {/* Top meta row (similar to Home) */}
            <div
              className={`text-sm ${metaText} flex flex-wrap items-center gap-2`}
            >
              <Link className={`${metaLink}`} href={adminViewHref} title="後台查看">
                {p.authorLabel} · {formatZhTwDateTime(p.createdAt)}
              </Link>

              <span
                className="rounded border px-2 py-0.5 text-xs bg-neutral-50 text-neutral-700"
                title={vb.label}
              >
                {vb.icon} {vb.label}
              </span>
            </div>

            {/* Content preview: clamp to 5 lines (same method as Home) */}
            <div
              className="whitespace-pre-wrap"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 5,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {content ? (
                content
              ) : (
                <span className="text-neutral-400">（無內容）</span>
              )}
            </div>

            {/* Media preview (same rule as Home) */}
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

            {/* Bottom meta row */}
            <div className="pt-3 border-t border-neutral-200/70">
              <div
                className={`flex flex-wrap items-center justify-between gap-3 text-sm ${metaText}`}
              >
                <div className="flex flex-wrap items-center gap-4">
                  <span className="inline-flex items-center gap-1" title="留言數">
                    💬 <span>{p.countComments}</span>
                  </span>

                  <span className="inline-flex items-center gap-1" title="按讚數">
                    ❤️ <span>{p.countLikes}</span>
                  </span>

                  <span
                    className="inline-flex items-center gap-1"
                    title="附件 / 媒體數量"
                  >
                    📎 <span>{p.countMedia}</span>
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

                <span className="text-neutral-400 select-none"> </span>
              </div>
            </div>

            {/* Action row (admin-only extra row) */}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <Link className="underline" href={adminViewHref} title={adminViewHref}>
                後台查看
              </Link>

              <Link className="underline" href={viewHref} title={viewHref}>
                前台查看
              </Link>

              <button
                type="button"
                className="underline cursor-pointer hover:opacity-80"
                title={editHref}
                onClick={() => router.push(editHref)}
              >
                編輯
              </button>

              <DeletePostButton postId={p.id} />
            </div>
          </article>
        );
      })}
    </div>
  );
}