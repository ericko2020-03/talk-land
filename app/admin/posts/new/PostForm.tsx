// path: app/admin/posts/new/PostForm.tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

type Visibility = "PUBLIC" | "LOGIN_ONLY" | "ADMIN_ONLY" | "ADMIN_DRAFT";

const MAX_FILES = 5;
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const DRAFT_KEY = "allensay_admin_draft_post_id";

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
function visibilityLabel(v: Visibility) {
  if (v === "PUBLIC") return "🌍 公開";
  if (v === "LOGIN_ONLY") return "👥 會員";
  if (v === "ADMIN_ONLY") return "🔒 封鎖（僅 Admin）";
  return "📝 草稿（僅 Admin）";
}
function storageKeyAttached(postId: string) {
  return `allensay_admin_attached_urls_${postId}`;
}

export default function PostForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [content, setContent] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("ADMIN_DRAFT");

  const [error, setError] = useState<string | null>(null);

  const [createdPostId, setCreatedPostId] = useState<string | null>(null);

  // upload UI
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  // 已 attach 的數量（用來判斷「只有圖片也可發布」）
  const [attachedCount, setAttachedCount] = useState(0);

  // ✅ 已附加圖片 URL（用於顯示縮圖）
  const [attachedUrls, setAttachedUrls] = useState<string[]>([]);

  const draftCreatingRef = useRef(false);
  const draftIdRef = useRef<string | null>(null);

  const hasText = useMemo(() => content.trim().length > 0, [content]);
  const hasPickedFiles = files.length > 0;
  const hasAnyImages = attachedCount > 0 || hasPickedFiles;

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => {
    return () => previews.forEach((u) => URL.revokeObjectURL(u));
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

    const combined = [...files, ...picked];
    if (combined.length > MAX_FILES) {
      alert(`每篇最多上傳 ${MAX_FILES} 張（你目前已選 ${files.length} 張，本次又選 ${picked.length} 張）`);
      return;
    }

    setFiles(combined);
  }

  // ✅ 進頁：同 session 只允許 1 個空草稿（原則不變，但不再顯示「草稿已建立」提示）
  useEffect(() => {
    let mounted = true;

    async function ensureDraft() {
      if (draftCreatingRef.current) return;
      if (createdPostId) return;

      draftCreatingRef.current = true;
      setError(null);

      try {
        const cached = typeof window !== "undefined" ? window.sessionStorage.getItem(DRAFT_KEY) : null;
        if (cached && cached.trim()) {
          const id = cached.trim();
          if (!mounted) return;

          draftIdRef.current = id;
          setCreatedPostId(id);

          // ✅ 載入已附加圖片（若有）
          try {
            const raw = window.sessionStorage.getItem(storageKeyAttached(id));
            const arr = raw ? (JSON.parse(raw) as string[]) : [];
            if (Array.isArray(arr)) {
              setAttachedUrls(arr);
              setAttachedCount(arr.length);
            }
          } catch {
            // ignore
          }

          draftCreatingRef.current = false;
          return;
        }

        const res = await fetch("/api/admin/posts/draft", { method: "POST" });
        const text = await res.text();
        const data = safeJsonParse(text) ?? {};

        if (!res.ok) {
          console.error("[draft] failed", res.status, text);
          setError(`建立草稿失敗：HTTP ${res.status} / ${(data as any)?.error ?? text ?? "unknown"}`);
          return;
        }

        const id = String((data as any)?.id ?? "").trim();
        if (!id) {
          setError("建立草稿成功但未取得 id（API 回傳格式錯誤）");
          return;
        }

        if (!mounted) return;

        draftIdRef.current = id;
        setCreatedPostId(id);
        window.sessionStorage.setItem(DRAFT_KEY, id);

        // 初始化附加圖清單
        window.sessionStorage.setItem(storageKeyAttached(id), JSON.stringify([]));
        setAttachedUrls([]);
        setAttachedCount(0);

        startTransition(() => router.refresh());
      } catch (err) {
        console.error("[draft] threw", err);
        const msg = err instanceof Error ? err.message : String(err);
        setError(`建立草稿時網路錯誤：${msg}`);
      } finally {
        draftCreatingRef.current = false;
      }
    }

    ensureDraft();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ 只要草稿已經「不是空白狀態」，就把 session draft key 清掉，避免下次誤用
  useEffect(() => {
    if (!createdPostId) return;

    const isEmptyDraft =
      visibility === "ADMIN_DRAFT" &&
      content.trim().length === 0 &&
      attachedCount === 0 &&
      files.length === 0 &&
      !normalizeYoutubeUrl(youtubeUrl);

    if (!isEmptyDraft) {
      try {
        window.sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        // ignore
      }
    }
  }, [createdPostId, visibility, content, attachedCount, files.length, youtubeUrl]);

  // ✅ 離頁：若仍是空白草稿 → 刪除（best-effort）
  useEffect(() => {
    function shouldDeleteEmptyDraft() {
      const id = draftIdRef.current;
      if (!id) return false;

      const isEmptyDraft =
        visibility === "ADMIN_DRAFT" &&
        content.trim().length === 0 &&
        attachedCount === 0 &&
        files.length === 0 &&
        !normalizeYoutubeUrl(youtubeUrl);

      return isEmptyDraft;
    }

    async function deleteDraftKeepAlive() {
      const id = draftIdRef.current;
      if (!id) return;
      try {
        await fetch(`/api/admin/posts/${id}/draft`, { method: "DELETE", keepalive: true });
      } catch {
        // ignore
      } finally {
        try {
          window.sessionStorage.removeItem(DRAFT_KEY);
          window.sessionStorage.removeItem(storageKeyAttached(id));
        } catch {
          // ignore
        }
      }
    }

    function onPageHide() {
      if (!shouldDeleteEmptyDraft()) return;
      void deleteDraftKeepAlive();
    }

    function onVisibilityChange() {
      if (document.visibilityState !== "hidden") return;
      if (!shouldDeleteEmptyDraft()) return;
      void deleteDraftKeepAlive();
    }

    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [visibility, content, attachedCount, files.length, youtubeUrl]);

  // ✅ 儲存/發布
  async function saveOrPublish() {
    if (!createdPostId || isPending) return;

    setError(null);

    // 非草稿：必須「有文字 or 有圖 or 有 YouTube」
    if (visibility !== "ADMIN_DRAFT") {
      const hasYoutube = !!normalizeYoutubeUrl(youtubeUrl);
      if (!hasText && !hasAnyImages && !hasYoutube) {
        setError("請至少輸入文字或上傳圖片或填入 YouTube 連結後再發佈。");
        return;
      }
    }

    const payload = {
      content,
      youtubeUrl: normalizeYoutubeUrl(youtubeUrl),
      visibility,
    };

    try {
      const res = await fetch(`/api/admin/posts/${createdPostId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      const data = safeJsonParse(text) ?? {};

      if (!res.ok) {
        console.error("[save/publish] failed", res.status, text);
        setError(`儲存失敗：HTTP ${res.status} / ${(data as any)?.error ?? text ?? "unknown"}`);
        return;
      }

      startTransition(() => router.refresh());
    } catch (err) {
      console.error("[save/publish] threw", err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(`儲存時網路錯誤：${msg}`);
    }
  }

  async function uploadImages() {
    if (uploading) return;
    if (!createdPostId) {
      alert("草稿尚未建立完成，請稍後再試。");
      return;
    }
    if (files.length === 0) return;

    setError(null);
    setUploading(true);

    try {
      const uploadedPublicUrls: string[] = [];
      const uploadedItems: { url: string; type: string; sortOrder: number }[] = [];

      for (let i = 0; i < files.length; i++) {
        const f = files[i];

        // 1) presign
        const presignRes = await fetch("/api/uploads/r2/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            postId: createdPostId,
            filename: f.name,
            contentType: f.type,
            size: f.size,
          }),
        });

        const presignText = await presignRes.text();
        const presignData: any = safeJsonParse(presignText) ?? {};

        if (!presignRes.ok) {
          console.error("[presign] failed", presignRes.status, presignText);
          setError(`(presign) 失敗：HTTP ${presignRes.status} / ${presignData?.error ?? presignText ?? "unknown"}`);
          return;
        }

        const uploadUrl = String(presignData?.uploadUrl ?? "");
        const publicUrl = String(presignData?.publicUrl ?? "");
        if (!uploadUrl || !publicUrl) {
          setError("(presign) 回傳缺 uploadUrl/publicUrl");
          return;
        }

        // 2) PUT to R2
        let putRes: Response;
        try {
          putRes = await fetch(uploadUrl, {
            method: "PUT",
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
          setError(`(PUT) 上傳到 R2 失敗：HTTP ${putRes.status}`);
          return;
        }

        uploadedPublicUrls.push(publicUrl);
        uploadedItems.push({
          url: publicUrl,
          type: "IMAGE",
          sortOrder: attachedCount + i,
        });
      }

      // 3) attach
      const attachRes = await fetch(`/api/admin/posts/${createdPostId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: uploadedItems }),
      });

      const attachText = await attachRes.text();
      const attachData: any = safeJsonParse(attachText) ?? {};

      if (!attachRes.ok) {
        console.error("[attach] failed:", attachRes.status, attachText);
        setError(`(attach) 失敗：HTTP ${attachRes.status} / ${attachData?.error ?? attachText ?? "unknown"}`);
        return;
      }

      // ✅ 更新已附加縮圖清單 + 寫入 sessionStorage（refresh/重整也不會消失）
      setAttachedCount((n) => n + uploadedItems.length);
      setAttachedUrls((prev) => {
        const next = [...prev, ...uploadedPublicUrls];
        try {
          window.sessionStorage.setItem(storageKeyAttached(createdPostId), JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });

      setFiles([]);
      startTransition(() => router.refresh());
    } catch (err) {
      console.error("[uploadImages] unexpected:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(`上傳流程未預期錯誤：${msg}`);
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

      {/* ✅ 貼文 ID：保留顯示，但不再塞一排「後台/前台/列表」按鈕 */}
      <div className="text-sm text-neutral-600">
        貼文 ID：{" "}
        <span className="font-mono break-all">{createdPostId ? createdPostId : "建立中…"}</span>
      </div>

      {/* ✅ 單一白底卡片內：內容 + 上傳 + 儲存 */}
      <section className="space-y-3">
        <textarea
          className="w-full rounded border p-3 h-48"
          placeholder="寫點什麼…（允許留空，只要你有上傳圖片）"
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
            <option value="PUBLIC">{visibilityLabel("PUBLIC")}</option>
            <option value="LOGIN_ONLY">{visibilityLabel("LOGIN_ONLY")}</option>
            <option value="ADMIN_ONLY">{visibilityLabel("ADMIN_ONLY")}</option>
            <option value="ADMIN_DRAFT">{visibilityLabel("ADMIN_DRAFT")}</option>
          </select>

          {/* ✅ 取消右側提示：「全空時只能維持草稿」 */}
        </div>
      </section>

      {/* 圖片上傳 */}
      <section className="space-y-3">
        <div>
          <div className="font-semibold">圖片附件</div>
          <div className="text-sm text-neutral-600">每篇最多 {MAX_FILES} 張，單張 ≤ 5MB</div>
          <div className="text-sm text-neutral-600">已附加：{attachedCount} 張</div>
        </div>

        {/* ✅ 已附加圖片預覽（你要的：完成上傳後立即看到效果） */}
        {attachedUrls.length > 0 ? (
          <div className="space-y-2">
            <div className="text-sm text-neutral-600">已上傳圖片預覽：</div>
            <div className="grid grid-cols-2 gap-2">
              {attachedUrls.map((url, idx) => (
                <div key={`${url}-${idx}`} className="rounded border overflow-hidden">
                  <img src={url} alt={`attached-${idx}`} className="w-full h-auto block" />
                </div>
              ))}
            </div>
          </div>
        ) : null}

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
            </div>
          ) : null}
        </div>
      </section>

      {/* ✅ 儲存草稿/發布：包進白底卡片內（黑底按鈕清楚） */}
      <div className="pt-2">
        <button
          className="rounded bg-black px-5 py-2 text-white disabled:opacity-50"
          type="button"
          disabled={!createdPostId || isPending}
          onClick={saveOrPublish}
          title={!createdPostId ? "草稿建立中" : undefined}
        >
          {isPending ? "儲存中..." : visibility === "ADMIN_DRAFT" ? "儲存草稿" : "發佈 / 更新"}
        </button>
      </div>
    </div>
  );
}