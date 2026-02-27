// path: app/admin/posts/new/PostForm.tsx
"use client";

import Link from "next/link";
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

  const draftCreatingRef = useRef(false);
  const draftIdRef = useRef<string | null>(null);

  // 用來做「是否已儲存」的粗略判斷（只針對 textarea 文字需求）
  const lastSavedContentRef = useRef<string>("");

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

  // ✅ 進頁：同 session 只允許 1 個空草稿（原則不變）
  useEffect(() => {
    let mounted = true;

    async function ensureDraft() {
      if (draftCreatingRef.current) return;
      if (createdPostId) return;

      draftCreatingRef.current = true;
      setError(null);

      try {
        const cached =
          typeof window !== "undefined" ? window.sessionStorage.getItem(DRAFT_KEY) : null;

        if (cached && cached.trim()) {
          const id = cached.trim();
          if (!mounted) return;
          draftIdRef.current = id;
          setCreatedPostId(id);
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

  // ✅ 只要草稿已經「不是空白狀態」，就把 session draft key 清掉，避免下次誤用（原則不變）
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

  // ✅ 離頁：若仍是空白草稿 → 刪除（best-effort）（原本就有，保留）
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

  async function saveWithVisibility(targetVisibility: Visibility) {
    if (!createdPostId || isPending) return { ok: false as const };

    setError(null);

    // 非草稿：必須「有文字 or 有圖」
    if (targetVisibility !== "ADMIN_DRAFT") {
      if (!hasText && !hasAnyImages) {
        setError("請至少輸入文字或上傳圖片後再發佈（允許只有圖片、文字空白）。");
        return { ok: false as const };
      }
    }

    const payload = {
      content,
      youtubeUrl: normalizeYoutubeUrl(youtubeUrl),
      visibility: targetVisibility,
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
        console.error("[save] failed", res.status, text);
        setError(`儲存失敗：HTTP ${res.status} / ${(data as any)?.error ?? text ?? "unknown"}`);
        return { ok: false as const };
      }

      // 記錄最後一次儲存的內容（用於「離開前自動存草稿」判斷）
      lastSavedContentRef.current = content;

      startTransition(() => router.refresh());
      return { ok: true as const };
    } catch (err) {
      console.error("[save] threw", err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(`儲存時網路錯誤：${msg}`);
      return { ok: false as const };
    }
  }

  // ✅ 儲存草稿/發布（按鈕在最下方）
  async function onClickSave() {
    if (!createdPostId) return;

    const target = visibility;
    const r = await saveWithVisibility(target);

    // ✅ 發布/更新（非草稿）成功 → 跳後台查看
    if (r.ok && target !== "ADMIN_DRAFT") {
      router.push(`/admin/posts/${createdPostId}`);
    }
  }

  // ✅ 點回文章列表/首頁時：若 textarea 有文字且「尚未儲存」→ 自動存為草稿後再跳
  async function maybeAutosaveDraftThenNavigate(href: string) {
    // 只依你需求：有文字才觸發
    if (!createdPostId) {
      router.push(href);
      return;
    }

    const now = content.trim();
    const last = (lastSavedContentRef.current ?? "").trim();
    const hasUnsavedText = now.length > 0 && now !== last;

    if (!hasUnsavedText) {
      router.push(href);
      return;
    }

    // 強制存成 ADMIN_DRAFT（不管目前 select 選了什麼）
    const r = await saveWithVisibility("ADMIN_DRAFT");
    if (r.ok) {
      router.push(href);
    }
    // 若失敗：留在頁面並顯示 error（setError 已做）
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
      const uploaded: { url: string; type: string; sortOrder: number }[] = [];

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

        uploaded.push({
          url: publicUrl,
          type: "IMAGE",
          sortOrder: attachedCount + i,
        });
      }

      // 3) attach
      const attachRes = await fetch(`/api/admin/posts/${createdPostId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: uploaded }),
      });

      const attachText = await attachRes.text();
      const attachData: any = safeJsonParse(attachText) ?? {};

      if (!attachRes.ok) {
        console.error("[attach] failed:", attachRes.status, attachText);
        setError(`(attach) 失敗：HTTP ${attachRes.status} / ${attachData?.error ?? attachText ?? "unknown"}`);
        return;
      }

      setAttachedCount((n) => n + uploaded.length);
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

  // =========================
  // UI style helpers
  // =========================
  const topLink = "underline text-white hover:text-white/80";
  const card = "rounded border bg-white text-neutral-900 p-4";
  const metaText = "text-sm text-neutral-600";
  const primaryBtn =
    "rounded bg-neutral-800 px-4 py-2 text-white hover:bg-neutral-700 disabled:opacity-50";
  const secondaryBtn =
    "rounded border px-4 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50";

  return (
    <div className="space-y-6">
      {/* ✅ Header（需要攔截跳轉 → 自動存草稿） */}
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">新增貼文</h1>
        <nav className="flex items-center gap-4 text-sm">
          <button
            type="button"
            className={topLink}
            onClick={() => void maybeAutosaveDraftThenNavigate("/admin/posts")}
          >
            回文章列表
          </button>
          <button
            type="button"
            className={topLink}
            onClick={() => void maybeAutosaveDraftThenNavigate("/")}
          >
            回首頁
          </button>
        </nav>
      </header>

      {/* ✅ 錯誤提示（保留） */}
      {error ? (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {/* ✅ 只保留貼文 ID（不再顯示「草稿已建立」banner） */}
      <div className={card}>
        {createdPostId ? (
          <div className="space-y-2">
            <div className={metaText}>
              貼文 ID：<span className="font-mono">{createdPostId}</span>
            </div>

            {/* ✅ 第二列靠右：後台查看 → 前台查看 → 回文章列表 */}
            <div className="flex justify-end gap-4 text-sm">
              <a className="underline" href={`/admin/posts/${createdPostId}`} target="_blank" rel="noreferrer">
                後台查看
              </a>
              <a className="underline" href={`/post/${createdPostId}`} target="_blank" rel="noreferrer">
                前台查看
              </a>
              <button
                type="button"
                className="underline"
                onClick={() => void maybeAutosaveDraftThenNavigate("/admin/posts")}
              >
                回文章列表
              </button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-neutral-600">建立草稿中…</div>
        )}
      </div>

      {/* ✅ 內容編輯（白卡） */}
      <section className={card + " space-y-3"}>
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

          <div className="text-xs text-neutral-500">
            {visibility === "ADMIN_DRAFT" ? "全空時只能維持草稿" : null}
          </div>
        </div>
      </section>

      {/* ✅ 圖片上傳（白卡） */}
      <section className={card + " space-y-3"}>
        <div>
          <div className="font-semibold">圖片附件</div>
          <div className="text-sm text-neutral-600">
            每篇最多 {MAX_FILES} 張，單張 ≤ 5MB
          </div>
          <div className="text-sm text-neutral-600">已附加：{attachedCount} 張</div>
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
                  className={primaryBtn}
                >
                  {uploading ? "上傳中..." : "上傳圖片"}
                </button>

                <button
                  type="button"
                  onClick={() => setFiles([])}
                  disabled={uploading}
                  className={secondaryBtn}
                >
                  清空已選
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* ✅ 儲存/發布：移到最下方（依你要求） */}
      <div className="flex justify-end">
        <button
          className={primaryBtn}
          type="button"
          disabled={!createdPostId || isPending}
          onClick={() => void onClickSave()}
          title={!createdPostId ? "草稿建立中" : undefined}
        >
          {isPending ? "儲存中..." : visibility === "ADMIN_DRAFT" ? "儲存草稿" : "發佈 / 更新"}
        </button>
      </div>
    </div>
  );
}