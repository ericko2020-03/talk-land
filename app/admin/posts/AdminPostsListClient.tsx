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
  preview: string;
  countComments: number;
  countLikes: number;
  countMedia: number;
};

function visibilityBadge(vRaw: string) {
  const v = String(vRaw ?? "").toUpperCase();

  // DB enum: PUBLIC / LOGIN_ONLY / ADMIN_ONLY / ADMIN_DRAFT
  // UI label: 公開 / 會員 / 封鎖 / 草稿
  if (v === "PUBLIC") return { label: "公開", icon: "🌍" };
  if (v === "LOGIN_ONLY") return { label: "會員", icon: "👥" };
  if (v === "ADMIN_ONLY") return { label: "封鎖", icon: "🔒" };
  if (v === "ADMIN_DRAFT") return { label: "草稿", icon: "📝" };

  return { label: "未知", icon: "❓" };
}

export default function AdminPostsListClient({ posts }: { posts: PostRow[] }) {
  const router = useRouter();

  return (
    <div className="space-y-3">
      {/* ✅ 用來確認手機是否真的吃到這個檔案 */}
      <div className="text-xs text-neutral-500 select-none">🧪MOBILE-CHECK</div>

      {posts.map((p) => {
        const editHref = `/admin/posts/${p.id}/edit`;
        const viewHref = `/post/${p.id}`;
        const vb = visibilityBadge(p.visibility);

        return (
          <article
            key={p.id}
            className="rounded border p-4 space-y-2 bg-white text-neutral-900"
          >
            <div className="text-sm text-neutral-600 flex flex-wrap items-center gap-2">
              <span>
                {p.authorLabel} · {new Date(p.createdAt).toLocaleString("zh-TW")}
              </span>

              <span
                className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs bg-neutral-50 text-neutral-800"
                title={vb.label}
                aria-label={vb.label}
              >
                <span className="select-none">{vb.icon}</span>
                <span>{vb.label}</span>
              </span>

              <span>💬 {p.countComments}</span>
              <span>❤️ {p.countLikes}</span>
              <span>🖼️ {p.countMedia}</span>
            </div>

            <div className="text-neutral-900">
              {p.preview ? (
                p.preview
              ) : (
                <span className="text-neutral-400">（無內容）</span>
              )}
            </div>

            <div className="flex items-center gap-4 text-sm">
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