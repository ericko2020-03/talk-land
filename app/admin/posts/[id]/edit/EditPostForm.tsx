// path: app/admin/posts/[id]/edit/EditPostForm.tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Visibility = "PUBLIC" | "LOGIN_ONLY";
type MediaLite = { id: string; url: string; type: string };

const MAX_FILES = 5;
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

function normalizeYoutubeUrl(input: string) {
  const s = (input ?? "").trim();
  return s.length > 0 ? s : null;
}
function isImage(file: File) {
  return file.type.startsWith("image/");
}

export default function EditPostForm(props: {
  postId: string;
  initialContent: string;
  initialYoutubeUrl: string;
  initialVisibility: Visibility;
  initialMedia: MediaLite[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [content, setContent] = useState(props.initialContent);
  const [youtubeUrl, setYoutubeUrl] = useState(props.initialYoutubeUrl);
  const [visibility, setVisibility] = useState<Visibility>(props.initialVisibility);

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // media upload UI
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const canSubmit = useMemo(() => content.trim().length > 0, [content]);

  const existingImages = useMemo(
    () => props.initialMedia.filter((m) => String(m.type || "").toUpperCase() === "IMAGE"),
    [props.initialMedia]
  );

  const remainingSlots = Math.max(0, MAX_FILES - existingImages.length);

  const previews = useMemo(() => {
    return files.map((f) => URL.createObjectURL(f));
  }, [files]);

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

      startTransition(() => {
        router.refresh();
      });
      setSaved(true);
    } catch {
      setError("網路或伺服器連線失敗，請稍後再試。");
    }
  }

  function onPickFiles(inputFiles: FileList | null) {
    if (!inputFiles) return;

    const picked = Array.from(inputFiles);

    const badType = picked.find((f) => !isImage(f));
    if (badType) {
      alert("只允許上傳圖片檔（image/*）");
      return;
    }

    const tooLarge = picked.find((f) => f.size > MAX_SIZE);
    if (tooLarge) {
      alert("單張圖片大小上限 5MB");
      return;
    }

    if (picked.length > remainingSlots) {
      alert(`此貼文最多 5 張圖，目前已 ${existingImages.length} 張，還能上傳 ${remainingSlots} 張`);
      return;
    }

    setFiles(picked);
  }

  async function uploadImages() {
    if (uploading) return;
    if (files.length === 0) return;

    setError(null);
    setSaved(false);

    if (remainingSlots <= 0) {
      alert("此貼文圖片已達上限（5 張）");
      return;
    }

    setUploading(true);
    try {
      const uploaded: { url: string; type: string; sortOrder: number }[] = [];

      for (let i = 0; i < files.length; i++) {
        const f = files[i];

        // 1) presign
        const presignRes = await fetch("/api/uploads/r2/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            postId: props.postId,
            filename: f.name,
            contentType: f.type,
            size: f.size,
          }),
        });

        const presignData = await presignRes.json().catch(() => ({}));
        if (!presignRes.ok) {
          setError(`取得上傳授權失敗：${presignData?.error ?? presignRes.status}`);
          return;
        }

        const uploadUrl = String(presignData?.uploadUrl ?? "");
        const publicUrl = String(presignData?.publicUrl ?? "");
        if (!uploadUrl || !publicUrl) {
          setError("上傳授權回傳格式錯誤");
          return;
        }

        // 2) PUT to R2
        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": f.type },
          body: f,
        });

        if (!putRes.ok) {
          setError(`上傳到 R2 失敗：HTTP ${putRes.status}`);
          return;
        }

        uploaded.push({
          url: publicUrl,
          type: "IMAGE",
          sortOrder: existingImages.length + i,
        });
      }

      // 3) attach to post (DB)
      const attachRes = await fetch(`/api/admin/posts/${props.postId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: uploaded }),
      });

      const attachData = await attachRes.json().catch(() => ({}));
      if (!attachRes.ok) {
        setError(`寫入附件資料失敗：${attachData?.error ?? attachRes.status}`);
        return;
      }

      setFiles([]);
      startTransition(() => {
        router.refresh();
      });
      setSaved(true);
    } catch {
      setError("上傳過程發生錯誤，請稍後再試。");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-8">
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

      <section className="space-y-3">
        <div>
          <div className="font-semibold">圖片附件</div>
          <div className="text-sm text-neutral-600">
            每篇最多 5 張，單張 ≤ 5MB（目前已有 {existingImages.length} 張，尚可上傳 {remainingSlots} 張）
          </div>
        </div>

        {existingImages.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {existingImages.map((m) => (
              <div key={m.id} className="rounded border overflow-hidden">
                <img src={m.url} alt="image" className="w-full h-auto block" />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-neutral-500">目前尚未上傳圖片。</div>
        )}

        <div className="space-y-2">
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={uploading || remainingSlots <= 0}
            onChange={(e) => onPickFiles(e.target.files)}
          />

          {files.length > 0 ? (
            <div className="space-y-2">
              <div className="text-sm text-neutral-600">即將上傳：{files.length} 張</div>

              <div className="grid grid-cols-2 gap-2">
                {previews.map((src, idx) => (
                  <div key={idx} className="rounded border overflow-hidden">
                    <img src={src} alt="preview" className="w-full h-auto block" />
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={uploadImages}
                disabled={uploading}
                className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
              >
                {uploading ? "上傳中..." : "上傳圖片"}
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}