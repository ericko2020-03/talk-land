// path: app/components/LikeButton.tsx
"use client";

import { useState } from "react";

function HeartIcon({ filled }: { filled: boolean }) {
  // 用 SVG 才能精準控制「淺紅 / 紅」與填色
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-5 w-5 ${filled ? "text-red-600" : "text-red-300"}`}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M12 21s-7.2-4.35-9.6-8.55C.6 9.3 2.4 6.6 5.4 6.15 7.05 5.9 8.7 6.6 9.75 7.8c.45.55.75 1.05.75 1.05s.3-.5.75-1.05c1.05-1.2 2.7-1.9 4.35-1.65 3 .45 4.8 3.15 3 6.3C19.2 16.65 12 21 12 21z" />
    </svg>
  );
}

export default function LikeButton(props: {
  postId: string;
  signedIn: boolean;
  initialLiked: boolean;
  initialCount: number;
}) {
  const [liked, setLiked] = useState(props.initialLiked);
  const [count, setCount] = useState(props.initialCount);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (!props.signedIn) {
      alert("請先登入才能按讚");
      return;
    }
    if (loading) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/posts/${props.postId}/like`, { method: "POST" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(`按讚失敗：${data?.error ?? res.status}`);
        return;
      }

      setLiked(!!data.liked);
      setCount(Number(data.count ?? count));
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className="inline-flex items-center gap-1 disabled:opacity-60"
      title={liked ? "取消按讚" : "按讚"}
    >
      <HeartIcon filled={liked} />
      <span className="text-sm text-neutral-600">{count}</span>
    </button>
  );
}