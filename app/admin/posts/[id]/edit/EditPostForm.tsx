// path: app/admin/posts/[id]/edit/EditPostForm.tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Visibility = "PUBLIC" | "LOGIN_ONLY";

function normalizeYoutubeUrl(input: string) {
  const s = (input ?? "").trim();
  return s.length > 0 ? s : null;
}

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
  const [visibility, setVisibility] = useState<Visibility>(
    props.initialVisibility
  );

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const canSubmit = useMemo(() => content.trim().length > 0, [content]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || isPending) return;

    setError(null);
    setSaved(false);

    const payload = {
      content: content.trim(),
      youtubeUrl: normalizeYoutubeUrl(youtubeUrl),
      visibility,
    };

    try {
      const res = await fetch(`/api/admin/posts/${props.postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const code = err?.error ?? res.status;

        if (res.status === 401) setError("尚未登入，請重新登入後再試。");
        else if (res.status === 403) setError("權限不足或帳號已被停用。");
        else if (res.status === 404) setError("找不到貼文或已刪除。");
        else setError(`更新失敗：${code}`);

        return;
      }

      // ✅ 後台習慣：留在本頁 + refresh + 顯示已儲存
      startTransition(() => {
        router.refresh();
      });
      setSaved(true);
    } catch {
      setError("網路或伺服器連線失敗，請稍後再試。");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {error ? (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {saved ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          已儲存變更。
        </div>
      ) : null}

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
        disabled={isPending || !canSubmit}
      >
        {isPending ? "儲存中..." : "儲存變更"}
      </button>
    </form>
  );
}