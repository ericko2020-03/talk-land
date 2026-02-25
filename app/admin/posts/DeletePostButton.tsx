// path: app/admin/posts/DeletePostButton.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export default function DeletePostButton({ postId }: { postId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function onDelete() {
    if (!confirm("確定要刪除這篇貼文嗎？")) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/posts/${postId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error ?? "刪除失敗");
        return;
      }

      startTransition(() => {
        router.refresh(); // 讓 /admin/posts 重新抓資料
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={submitting || isPending}
      className="underline text-red-600 disabled:opacity-60"
    >
      {submitting || isPending ? "刪除中..." : "刪除"}
    </button>
  );
}