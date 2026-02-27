// path: app/admin/layout.tsx
import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  // ✅ 全站一致的 container（後台）
  // - 手機：黑底白字（符合你目前後台偏好）
  // - 桌機：透明（不要黑底，讓系統白底出來）
  const shell =
    "min-h-screen bg-black text-white sm:bg-transparent sm:text-neutral-900";

  // ✅ 統一寬度與內距（你要的「全站一致 container」核心）
  const container = "mx-auto w-full max-w-2xl px-4 py-6 sm:px-6";

  return (
    <div className={shell}>
      <div className={container}>{children}</div>
    </div>
  );
}