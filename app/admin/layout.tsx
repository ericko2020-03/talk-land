// path: app/admin/layout.tsx
import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  // ✅ 全站一致的 container（後台）
  // - 手機：黑底白字（符合你目前後台偏好）
  // - 桌機：透明（不要黑底，讓系統白底出來）
  const shell =
    "min-h-screen bg-black text-white sm:bg-transparent sm:text-neutral-900";

  // ✅ 關鍵修正：
  // - 移除 max-w-2xl（它會讓後台比前台窄）
  // - 手機滿版：max-w-none
  // - 桌機收斂到較窄（你說要大約目前的 2/3）：max-w-3xl
  const container = "mx-auto w-full max-w-none px-3 py-5 sm:px-6 sm:py-8 sm:max-w-3xl";

  return (
    <div className={shell}>
      <div className={container}>{children}</div>
    </div>
  );
}