// path: app/admin/posts/[id]/edit/EditPostForm.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Visibility = "PUBLIC" | "LOGIN_ONLY";

export default function EditPostForm(props: {
  postId: string;
  initialContent: string;
  initialYoutubeUrl: string;
  initialVisibility: Visibility;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [content, setContent] = useState(props.initialContent);
  const [youtubeUrl, setYoutubeUrl] = useState(props.initialYoutubeUrl);
  const [visibility, setVisibility] = useState<Visibility>(props.initialVisibility);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const res = await fetch(`/api/admin/posts/${props.postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: content.trim(),
        youtubeUrl: youtubeUrl.trim() || null,
        visibility,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(`更新失敗：${err?.error ?? res.status}`);
      return;
    }

    startTransition(() => {
      router.push("/admin/posts");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <textarea
        className="w-full rounded border p-3 h-60"
        placeholder="內容…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />

      <input
        className="w-full rounded border p-2"
        placeholder="YouTube 連結（可留空）"
        value={youtubeUrl}
        onChange={(e) => setYoutubeUrl(e.target.value)}
      />

      <div className="flex items-center gap-3">
        <label className="text-sm text-neutral-600">可見性</label>
        <select
          className="rounded border p-2"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as Visibility)}
        >
          <option value="PUBLIC">公開</option>
          <option value="LOGIN_ONLY">登入可見</option>
        </select>
      </div>

      <button
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        type="submit"
        disabled={isPending || content.trim().length === 0}
      >
        {isPending ? "儲存中..." : "儲存變更"}
      </button>
    </form>
  );
}