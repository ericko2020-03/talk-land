// path: app/admin/layout.tsx
import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const shell =
    "min-h-screen bg-black text-white sm:bg-transparent sm:text-neutral-900";

  // ✅ 桌機寬度：至少 1/2 螢幕，但不要無上限（同前台）
  const container =
    "mx-auto w-full max-w-none px-3 py-5 sm:px-6 sm:py-8 sm:max-w-[50vw] lg:max-w-3xl";

  return (
    <div className={shell}>
      <div className={container}>{children}</div>
    </div>
  );
}