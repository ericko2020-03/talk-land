// path: app/post/[id]/CommentForm.tsx
"use client";

import { useState } from "react";

export default function CommentForm({ postId, signedIn }: { postId: string; signedIn: boolean }) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (res.ok) {
        setContent("");
        window.location.reload(); // v1.1 demo：最穩
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
        <a className="underline" href={`/api/auth/signin?callbackUrl=/post/${postId}`}>
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
        disabled={submitting}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-60"
        type="submit"
      >
        送出留言
      </button>
    </form>
  );
}