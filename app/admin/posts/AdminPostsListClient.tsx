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

export default function AdminPostsListClient({ posts }: { posts: PostRow[] }) {
  const router = useRouter();

  return (
    <div className="block w-full min-w-0 space-y-4">
      {posts.map((p) => (
        <article
          key={p.id}
          className="block w-full min-w-0 as-card as-card-pad space-y-3"
        >
          <div className="text-sm text-neutral-600">
            {p.authorLabel} ·{" "}
            {new Date(p.createdAt).toLocaleString("zh-TW")}
          </div>

          <div className="whitespace-pre-wrap">{p.content}</div>

          <div className="pt-3 border-t border-neutral-200/70 flex gap-4 text-sm">
            <Link href={`/admin/posts/${p.id}`} className="underline">
              後台查看
            </Link>

            <Link href={`/post/${p.id}`} className="underline">
              前台查看
            </Link>

            <button
              onClick={() => router.push(`/admin/posts/${p.id}/edit`)}
              className="underline"
            >
              編輯
            </button>

            <DeletePostButton postId={p.id} />
          </div>
        </article>
      ))}
    </div>
  );
}