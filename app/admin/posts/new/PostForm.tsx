// path: app/admin/posts/new/PostForm.tsx
"use client";

import { useState } from "react";

export default function PostForm() {
  const [content, setContent] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [visibility, setVisibility] = useState("PUBLIC");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const res = await fetch("/api/admin/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        youtubeUrl: youtubeUrl.trim() ? youtubeUrl.trim() : null,
        visibility,
      }),
    });

    if (res.ok) {
      alert("發文成功");
      setContent("");
      setYoutubeUrl("");
      setVisibility("PUBLIC");
    } else {
      const err = await res.json().catch(() => ({}));
      alert(`發文失敗：${err?.error ?? res.status}`);
    }
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
          onChange={(e) => setVisibility(e.target.value)}
        >
          <option value="PUBLIC">公開</option>
          <option value="LOGIN_ONLY">登入可見</option>
        </select>
      </div>

      <button className="rounded bg-black px-4 py-2 text-white" type="submit">
        發佈
      </button>
    </form>
  );
}