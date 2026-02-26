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

  // DB: LOGIN_ONLY，但 UI: 會員
  if (v === "PUBLIC") return { label: "公開", icon: "🌍" };
  if (v === "LOGIN_ONLY") return { label: "會員", icon: "👥" };
  if (v === "ADMIN_ONLY") return { label: "封鎖", icon: "🔒" };
  if (v === "ADMIN_DRAFT") return { label: "草稿", icon: "📝" };

  return { label: v || "UNKNOWN", icon: "❓" };
}

export default function AdminPostsListClient({ posts }: { posts: PostRow[] }) {
  const router = useRouter();

  return (
    <>
      {posts.map((p) => {
        const adminViewHref = `/admin/posts/${p.id}`; // ✅ 新增：後台查看（可看草稿/封鎖）
        const editHref = `/admin/posts/${p.id}/edit`;
        const viewHref = `/post/${p.id}`;
        const vb = visibilityBadge(p.visibility);

        return (
          <article key={p.id} className="rounded border p-4 space-y-2 bg-white text-neutral-900">
            <div className="text-sm text-neutral-600 flex flex-wrap items-center gap-2">
              <span>
                {p.authorLabel} · {new Date(p.createdAt).toLocaleString("zh-TW")}
              </span>

              <span className="rounded border px-2 py-0.5 text-xs bg-neutral-50 text-neutral-700" title={vb.label}>
                {vb.icon} {vb.label}
              </span>

              <span>💬 {p.countComments}</span>
              <span>❤️ {p.countLikes}</span>
              <span>🖼️ {p.countMedia}</span>
            </div>

            <div className="text-neutral-900">
              {p.preview ? p.preview : <span className="text-neutral-400">（無內容）</span>}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm">
              {/* ✅ 新增：後台查看（Admin 任何狀態都可看） */}
              <Link className="underline" href={adminViewHref} title={adminViewHref}>
                後台查看
              </Link>

              {/* ✅ 保留：前台查看（一般使用者視角；草稿/封鎖會顯示找不到，這是預期） */}
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
    </>
  );
}