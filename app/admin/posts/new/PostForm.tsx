// path: app/admin/posts/new/PostForm.tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

type Visibility = "PUBLIC" | "LOGIN_ONLY";

type PresignResponse = {
  uploadUrl: string;
  publicUrl: string;
};

const MAX_FILES = 5;
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

function normalizeYoutubeUrl(input: string) {
  const s = (input ?? "").trim();
  return s.length > 0 ? s : null;
}

function isImage(file: File) {
  return file.type.startsWith("image/");
}

function safeJsonParse(text: string) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return null;
  }
}

export default function PostForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [content, setContent] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("PUBLIC");

  const [error, setError] = useState<string | null>(null);

  // ✅ 新增貼文成功後保存 postId，才能上傳圖片（presign 需要 postId）
  const [createdPostId, setCreatedPostId] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  // upload UI
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const canSubmit = useMemo(() => content.trim().length > 0, [content]);

  // ✅ previews with revoke to avoid memory leak
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => {
    return () => {
      for (const url of previews) URL.revokeObjectURL(url);
    };
  }, [previews]);

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

    // ✅ 允許追加，但總數仍不得超過 MAX_FILES
    const combined = [...files, ...picked];
    if (combined.length > MAX_FILES) {
      alert(`每篇最多上傳 ${MAX_FILES} 張（你目前已選 ${files.length} 張，本次又選 ${picked.length} 張）`);
      return;
    }

    setFiles(combined);
  }

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

      const text = await res.text();
      const data = safeJsonParse(text) ?? {};

      if (!res.ok) {
        const code = (data as any)?.error ?? res.status;

        if (res.status === 401) setError("尚未登入，請重新登入後再試。");
        else if (res.status === 403) setError("權限不足或帳號已被停用。");
        else setError(`發文失敗：${code}`);

        console.error("[create post] failed", res.status, text);
        return;
      }

      // ✅ 需要後端回傳 { id: post.id }，才能開始上傳圖片
      const newId = String((data as any)?.id ?? "").trim();
      if (!newId) {
        setError(
          "發文成功，但 API 沒有回傳貼文 id（需要 id 才能上傳圖片）。請調整 /api/admin/posts 回傳格式。"
        );
        console.error("[create post] ok but missing id", text);
        return;
      }

      setCreatedPostId(newId);
      setCreated(true);

      // ✅ 不跳頁：留在此頁讓你繼續上傳圖片
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error("[create post] threw", err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(`網路或伺服器連線失敗：${msg}`);
    }
  }

  async function uploadImages() {
    if (uploading) return;
    if (!createdPostId) {
      alert("請先發佈貼文，建立後才能上傳圖片。");
      return;
    }
    if (files.length === 0) return;

    setError(null);
    setUploading(true);

    try {
      console.log("[uploadImages] postId =", createdPostId, "files =", files.length);

      const uploaded: { url: string; type: string; sortOrder: number }[] = [];

      for (let i = 0; i < files.length; i++) {
        const f = files[i];

        // 1) presign
        let presignRes: Response;
        try {
          presignRes = await fetch("/api/uploads/r2/presign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              postId: createdPostId,
              filename: f.name,
              contentType: f.type,
              size: f.size,
            }),
          });
        } catch (err) {
          console.error("[presign] fetch threw:", err);
          const msg = err instanceof Error ? err.message : String(err);
          setError(`(presign) 網路錯誤：${msg}`);
          return;
        }

        const presignText = await presignRes.text();
        const presignJson = safeJsonParse(presignText);
        const presignData: any = presignJson ?? {};

        if (!presignRes.ok) {
          console.error("[presign] failed:", presignRes.status, presignText);
          setError(
            `(presign) 失敗：HTTP ${presignRes.status} / ${presignData?.error ?? presignText ?? "unknown"}`
          );
          return;
        }

        const uploadUrl = String(presignData?.uploadUrl ?? "");
        const publicUrl = String(presignData?.publicUrl ?? "");
        if (!uploadUrl || !publicUrl) {
          console.error("[presign] bad payload:", presignData);
          setError("(presign) 回傳缺 uploadUrl/publicUrl");
          return;
        }

        // 2) PUT to R2
        let putRes: Response;
        try {
          putRes = await fetch(uploadUrl, {
            method: "PUT",
            // ⚠️ 若你之後發現是簽名不匹配，可先把這行拿掉測試：
            headers: { "Content-Type": f.type },
            body: f,
          });
        } catch (err) {
          console.error("[PUT] threw (likely CORS):", err);
          const msg = err instanceof Error ? err.message : String(err);
          setError(`(PUT) 上傳到 R2 被瀏覽器擋下：${msg}（常見為 CORS）`);
          return;
        }

        if (!putRes.ok) {
          console.error("[PUT] failed:", putRes.status);
          setError(`(PUT) 上傳到 R2 失敗：HTTP ${putRes.status}`);
          return;
        }

        uploaded.push({
          url: publicUrl,
          type: "IMAGE",
          sortOrder: i, // 新貼文從 0 開始
        });
      }

      // 3) attach to post (DB)
      const attachRes = await fetch(`/api/admin/posts/${createdPostId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: uploaded }),
      });

      const attachText = await attachRes.text();
      const attachJson = safeJsonParse(attachText);
      const attachData: any = attachJson ?? {};

      if (!attachRes.ok) {
        console.error("[attach] failed:", attachRes.status, attachText);
        setError(`(attach) 失敗：HTTP ${attachRes.status} / ${attachData?.error ?? attachText ?? "unknown"}`);
        return;
      }

      setFiles([]);
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error("[uploadImages] unexpected:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(`上傳流程未預期錯誤：${msg}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="space-y-3">
        {error ? (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        ) : null}

        {created ? (
          <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            已建立貼文（可繼續上傳圖片）。
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
          disabled={isPending || !canSubmit || created}
          title={created ? "已建立貼文" : undefined}
        >
          {isPending ? "發佈中..." : created ? "已發佈" : "發佈"}
        </button>

        {createdPostId ? (
          <div className="text-sm text-neutral-600">
            貼文 ID：<span className="font-mono">{createdPostId}</span>{" "}
            <a className="underline" href={`/post/${createdPostId}`} target="_blank" rel="noreferrer">
              前台查看
            </a>{" "}
            ·{" "}
            <a className="underline" href="/admin/posts">
              回文章列表
            </a>
          </div>
        ) : null}
      </form>

      {/* ✅ 新增貼文：圖片上傳 */}
      <section className="space-y-3">
        <div>
          <div className="font-semibold">圖片附件</div>
          <div className="text-sm text-neutral-600">
            每篇最多 {MAX_FILES} 張，單張 ≤ 5MB
          </div>
          {!createdPostId ? (
            <div className="text-sm text-amber-700">
              請先按「發佈」建立貼文，建立後才可上傳圖片（因為上傳授權需要 postId）。
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <input
            id="pick-images-new"
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={!createdPostId || uploading}
            onChange={(e) => onPickFiles(e.target.files)}
          />

          <label
            htmlFor="pick-images-new"
            className={`inline-flex items-center justify-center rounded border px-4 py-2 text-sm
            ${!createdPostId || uploading ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-neutral-50"}`}
          >
            選擇圖片（最多 {MAX_FILES} 張）
          </label>

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

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={uploadImages}
                  disabled={uploading || !createdPostId}
                  className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
                >
                  {uploading ? "上傳中..." : "上傳圖片"}
                </button>

                <button
                  type="button"
                  onClick={() => setFiles([])}
                  disabled={uploading}
                  className="rounded border px-4 py-2 text-sm disabled:opacity-50"
                >
                  清空已選
                </button>
              </div>

              <div className="text-xs text-neutral-500">
                若你看到 (PUT) 被瀏覽器擋下（Failed to fetch），幾乎是 R2 CORS 或 presign 簽名條件不一致造成。
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}