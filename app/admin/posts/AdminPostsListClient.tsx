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

export default function AdminPostsListClient({ posts }: { posts: PostRow[] }) {
  const router = useRouter();

  return (
    <>
      {posts.map((p) => {
        const editHref = `/admin/posts/${p.id}/edit`;
        const viewHref = `/post/${p.id}`;

        return (
          <article key={p.id} className="rounded border p-4 space-y-2">
            <div className="text-sm text-neutral-500">
              {p.authorLabel} · {new Date(p.createdAt).toLocaleString("zh-TW")}
              {" · "}
              <span className="uppercase">{p.visibility}</span>
              {" · "}💬 {p.countComments}
              {" · "}❤️ {p.countLikes}
              {" · "}🖼️ {p.countMedia}
            </div>

            <div className="text-neutral-900">{p.preview}</div>

            <div className="flex items-center gap-4 text-sm">
              <Link className="underline" href={viewHref} title={viewHref}>
                前台查看
              </Link>

              {/* 用 button + router.push，避免被任何 overlay/link 影響 */}
              <button
                type="button"
                className="underline"
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