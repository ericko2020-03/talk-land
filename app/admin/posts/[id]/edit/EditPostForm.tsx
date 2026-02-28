// path: app/admin/posts/[id]/edit/EditPostForm.tsx
"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";

type Visibility = "PUBLIC" | "LOGIN_ONLY" | "ADMIN_ONLY" | "ADMIN_DRAFT";
type MediaLite = { id: string; url: string; type: string };

const MAX_FILES = 5;
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function normalizeYoutubeUrl(input: string) {
  const s = (input ?? "").trim();
  return s.length > 0 ? s : null;
}

function isAllowedImage(file: File) {
  return ALLOWED_MIME.has(file.type);
}

function visibilityLabel(v: Visibility) {
  if (v === "PUBLIC") return "🌍 公開";
  if (v === "LOGIN_ONLY") return "👥 會員";
  if (v === "ADMIN_ONLY") return "🔒 封鎖（僅 Admin）";
  return "📝 草稿（僅 Admin）";
}

async function uploadToServer(file: File) {
  const fd = new FormData();
  fd.append("file", file); // IMPORTANT: must match API route.ts form.get("file")

  const res = await fetch("/api/upload", {
    method: "POST",
    body: fd,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data?.detail || data?.error || `Upload failed: HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data as { key: string; publicUrl: string };
}

function uniqUrls(urls: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const s = String(u ?? "").trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
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

  const [content, setContent] = useState(props.initialContent ?? "");
  const [youtubeUrl, setYoutubeUrl] = useState(props.initialYoutubeUrl ?? "");
  const [visibility, setVisibility] = useState<Visibility>(
    props.initialVisibility ?? "ADMIN_DRAFT"
  );

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // media upload UI
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const serverExistingImages = useMemo(
    () =>
      props.initialMedia.filter(
        (m) => String(m.type || "").toUpperCase() === "IMAGE"
      ),
    [props.initialMedia]
  );

  // ✅ 立即顯示規則：成功上傳/attach 後，直接把 URL 加進這個 state（仿照 new/PostForm.tsx）
  const [attachedUrls, setAttachedUrls] = useState<string[]>(() =>
    uniqUrls(serverExistingImages.map((m) => m.url))
  );

  // 當 server refresh 回來（props.initialMedia 更新）時，也同步 attachedUrls（避免 client 與 DB 不一致）
  useEffect(() => {
    setAttachedUrls((prev) =>
      uniqUrls([...prev, ...serverExistingImages.map((m) => m.url)])
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverExistingImages.map((m) => m.url).join("|")]);

  const remainingSlots = useMemo(() => {
    // 以「已顯示的 attachedUrls」為準，避免剛上傳成功但尚未 refresh 時，還能繼續超過上限
    return Math.max(0, MAX_FILES - attachedUrls.length);
  }, [attachedUrls.length]);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);

  // cleanup preview object URLs (avoid memory leak)
  useEffect(() => {
    return () => {
      previews.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previews.join("|")]);

  const hasText = useMemo(() => content.trim().length > 0, [content]);
  const hasAnyImages = useMemo(
    () => attachedUrls.length > 0 || files.length > 0,
    [attachedUrls.length, files.length]
  );

  // ✅ 送出規則：草稿可全空；非草稿需至少文字或圖片（沿用既有邏輯）
  const canSubmit = useMemo(() => {
    if (visibility === "ADMIN_DRAFT") return true;
    return hasText || hasAnyImages;
  }, [visibility, hasText, hasAnyImages]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || isPending) return;

    setError(null);
    setSaved(false);

    const payload = {
      content: String(content ?? "").trimEnd(),
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
        else if (res.status === 400 && code === "EMPTY_CONTENT_AND_NO_MEDIA") {
          setError("公開/會員/封鎖 必須至少有文字或圖片。若要全空，請維持草稿。");
        } else setError(`更新失敗：${code}`);

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

    const badType = picked.find((f) => !isAllowedImage(f));
    if (badType) {
      alert("只允許上傳圖片檔（jpeg/png/webp/gif）");
      return;
    }

    const tooLarge = picked.find((f) => f.size > MAX_SIZE);
    if (tooLarge) {
      alert("單張圖片大小上限 5MB");
      return;
    }

    if (picked.length > remainingSlots) {
      alert(
        `此貼文最多 ${MAX_FILES} 張圖，目前已 ${attachedUrls.length} 張，還能上傳 ${remainingSlots} 張`
      );
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
      alert(`此貼文圖片已達上限（${MAX_FILES} 張）`);
      return;
    }

    setUploading(true);
    try {
      const uploadedItems: { url: string; type: string; sortOrder: number }[] = [];
      const uploadedUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const f = files[i];

        // 1) upload to server (server -> R2)
        const { publicUrl } = await uploadToServer(f);

        uploadedUrls.push(publicUrl);
        uploadedItems.push({
          url: publicUrl,
          type: "IMAGE",
          sortOrder: attachedUrls.length + i,
        });
      }

      // 2) attach to post (DB)
      const attachRes = await fetch(`/api/admin/posts/${props.postId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: uploadedItems }),
      });

      const attachData = await attachRes.json().catch(() => ({}));
      if (!attachRes.ok) {
        setError(`寫入附件資料失敗：${attachData?.error ?? attachRes.status}`);
        return;
      }

      // ✅ 立刻顯示：仿照 new/PostForm.tsx 的「上傳成功就顯示已上傳圖片」
      setAttachedUrls((prev) => uniqUrls([...prev, ...uploadedUrls]));

      setFiles([]);
      startTransition(() => {
        router.refresh();
      });
      setSaved(true);
    } catch (e: any) {
      setError(`上傳過程發生錯誤：${String(e?.message ?? e)}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
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

      {/* ✅ 貼文 ID（new 有顯示，edit 也補一致） */}
      <div className="text-sm text-neutral-600">
        貼文 ID：{" "}
        <span className="font-mono break-all">{props.postId}</span>
      </div>

      {/* 內容 + YouTube + 可見性 */}
      <section className="space-y-3">
        <textarea
          className="w-full rounded border p-3 h-60"
          placeholder="內容…（允許留空，只要你有圖片；若要全空請維持草稿）"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setSaved(false);
          }}
        />

        <input
          className="w-full rounded border p-2"
          placeholder="YouTube 連結（可留空）"
          value={youtubeUrl}
          onChange={(e) => {
            setYoutubeUrl(e.target.value);
            setSaved(false);
          }}
        />

        <div className="flex items-center gap-3">
          <label className="text-sm text-neutral-600">可見性</label>
          <select
            className="rounded border p-2"
            value={visibility}
            onChange={(e) => {
              const next = e.target.value as Visibility;
              setVisibility(next);
              setSaved(false);
              setError(null);
            }}
          >
            <option value="PUBLIC">{visibilityLabel("PUBLIC")}</option>
            <option value="LOGIN_ONLY">{visibilityLabel("LOGIN_ONLY")}</option>
            <option value="ADMIN_ONLY">{visibilityLabel("ADMIN_ONLY")}</option>
            <option value="ADMIN_DRAFT">{visibilityLabel("ADMIN_DRAFT")}</option>
          </select>

          <div className="text-xs text-neutral-500">
            {visibility === "ADMIN_DRAFT"
              ? "草稿允許全空；其他狀態需至少文字或圖片。"
              : null}
          </div>
        </div>

        <button
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
          type="button"
          onClick={() => {
            // form submit but保持原本 onSubmit 行為
            const fake = { preventDefault() {} } as any;
            void onSubmit(fake);
          }}
          disabled={isPending || !canSubmit}
        >
          {isPending ? "儲存中..." : "儲存變更"}
        </button>
      </section>

      {/* 圖片附件（仿照 new 的顯示方式） */}
      <section className="space-y-3">
        <div>
          <div className="font-semibold">圖片附件</div>
          <div className="text-sm text-neutral-600">
            每篇最多 {MAX_FILES} 張，單張 ≤ 5MB
          </div>
          <div className="text-sm text-neutral-600">
            已附加：{attachedUrls.length} 張（尚可上傳 {remainingSlots} 張）
          </div>
        </div>

        {/* ✅ 已附加圖片預覽：用 attachedUrls（上傳成功立刻顯示） */}
        {attachedUrls.length > 0 ? (
          <div className="space-y-2">
            <div className="text-sm text-neutral-600">已上傳圖片預覽：</div>
            <div className="grid grid-cols-2 gap-2">
              {attachedUrls.map((url, idx) => (
                <div
                  key={`${url}-${idx}`}
                  className="rounded border overflow-hidden"
                >
                  <img src={url} alt={`attached-${idx}`} className="w-full h-auto block" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-sm text-neutral-500">目前尚未上傳圖片。</div>
        )}

        <div className="space-y-2">
          <input
            id="pick-images-edit"
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={uploading || remainingSlots <= 0}
            onChange={(e) => onPickFiles(e.target.files)}
          />

          <label
            htmlFor="pick-images-edit"
            className={`inline-flex items-center justify-center rounded border px-4 py-2 text-sm
            ${
              uploading || remainingSlots <= 0
                ? "opacity-50 cursor-not-allowed"
                : "cursor-pointer hover:bg-neutral-50"
            }`}
          >
            選擇圖片（最多 {remainingSlots} 張）
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
                  disabled={uploading}
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
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}