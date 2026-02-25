// path: app/admin/posts/new/PostForm.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Visibility = "PUBLIC" | "LOGIN_ONLY";

export default function PostForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [content, setContent] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("PUBLIC");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const res = await fetch("/api/admin/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: content.trim(),
        youtubeUrl: youtubeUrl.trim() ? youtubeUrl.trim() : null,
        visibility,
      }),
    });

    if (res.ok) {
      // 讓體感更好：直接回首頁並刷新，確保看到最新貼文
      startTransition(() => {
        router.push("/");
        router.refresh();
      });
      return;
    }

    const err = await res.json().catch(() => ({}));
    alert(`發文失敗：${err?.error ?? res.status}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        className="w-full rounded border p-3 h-48"
        placeholder="寫點什麼…"
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
        {isPending ? "發佈中..." : "發佈"}
      </button>
    </form>
  );
}