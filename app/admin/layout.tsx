// path: app/admin/layout.tsx
import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  // ✅ 後台外殼只負責「配色」，不要再做寬度/內距
  // - 手機：黑底白字
  // - 桌機：透明（用系統白底）
  const shell =
    "min-h-screen bg-black text-white sm:bg-transparent sm:text-neutral-900";

  return <div className={shell}>{children}</div>;
}