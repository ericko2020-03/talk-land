// path: app/admin/posts/new/PostForm.tsx
"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type Visibility = "PUBLIC" | "LOGIN_ONLY";

function normalizeYoutubeUrl(input: string) {
  const s = (input ?? "").trim();
  return s.length > 0 ? s : null;
}

export default function PostForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [content, setContent] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("PUBLIC");

  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => content.trim().length > 0, [content]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || isPending) return;

    setError(null);

    const payload = {
      content: content.trim(),
      youtubeUrl: normalizeYoutubeUrl(youtubeUrl),
      visibility,
    };

    try {
      const res = await fetch("/api/admin/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const code = err?.error ?? res.status;

        if (res.status === 401) setError("尚未登入，請重新登入後再試。");
        else if (res.status === 403) setError("權限不足或帳號已被停用。");
        else setError(`發文失敗：${code}`);

        return;
      }

      // ✅ Admin 工作流：成功後回文章列表（而不是回首頁）
      startTransition(() => {
        router.push("/admin/posts");
        router.refresh();
      });
    } catch {
      setError("網路或伺服器連線失敗，請稍後再試。");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error ? (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

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
        disabled={isPending || !canSubmit}
      >
        {isPending ? "發佈中..." : "發佈"}
      </button>
    </form>
  );
}