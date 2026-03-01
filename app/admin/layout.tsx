// path: app/admin/layout.tsx
import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  // ✅ 後台只管背景/字色：不要再加 mx-auto / max-w / px
  //    寬度與 padding 全交給 RootLayout 的 <main>
  const shell =
    "min-h-screen bg-black text-white sm:bg-transparent sm:text-neutral-900";

  return <div className={shell}>{children}</div>;
}