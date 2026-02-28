// path: app/admin/layout.tsx
import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  // ✅ 後台 shell（維持你目前後台偏好）
  // - 手機：黑底白字
  // - 桌機：透明（讓外層白底顯示）
  const shell =
    "min-h-screen bg-black text-white sm:bg-transparent sm:text-neutral-900";

  // ✅ 關鍵：後台不要鎖 max-w-2xl
  // - 手機：滿版
  // - 桌機：跟前台一致 max-w-4xl（約 2/3 寬）
  const container =
    "mx-auto w-full max-w-none px-3 py-5 sm:px-6 sm:py-8 sm:max-w-4xl";

  return (
    <div className={shell}>
      <div className={container}>{children}</div>
    </div>
  );
}