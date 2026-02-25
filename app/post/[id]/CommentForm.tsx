// path: app/post/[id]/CommentForm.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export default function CommentForm({
  postId,
  signedIn,
}: {
  postId: string;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = content.trim();
    if (!text) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });

      if (res.ok) {
        setContent("");

        // ✅ 留在本頁：只 refresh，不做任何 push/導頁
        startTransition(() => {
          router.refresh();
        });
        return;
      }

      const err = await res.json().catch(() => ({}));
      alert(`留言失敗：${err?.error ?? res.status}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (!signedIn) {
    return (
      <div className="text-sm">
        <a
          className="underline"
          href={`/api/auth/signin?callbackUrl=/post/${postId}`}
        >
          登入
        </a>{" "}
        後即可留言。
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea
        className="w-full rounded border p-2 h-24"
        placeholder="寫下留言…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <button
        disabled={submitting || isPending}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-60"
        type="submit"
      >
        {submitting || isPending ? "送出中..." : "送出留言"}
      </button>
    </form>
  );
}