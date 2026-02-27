// path: app/admin/posts/new/page.tsx
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { assertAdmin, assertActive } from "@/lib/rbac";
import PostForm from "./PostForm";

export default async function NewPostPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent("/admin/posts/new")}`);
  }

  const role = (session.user as any).role;
  const status = (session.user as any).status;

  try {
    assertActive(status);
    assertAdmin(role);
  } catch {
    redirect("/");
  }

  // ✅ 外層風格（同首頁規則）
  // - 手機：黑底白字
  // - 桌機：透明（讓系統白底出來）
  const pageShell =
    "min-h-screen space-y-6 bg-black text-white sm:bg-transparent sm:text-neutral-900";

  const topLink =
    "underline text-white hover:text-white/80 sm:text-neutral-900 sm:hover:text-neutral-700";

  return (
    <div className={pageShell}>
      {/* ✅ 不用 mx-auto / max-w / px-4，避免比首頁窄 */}
      <header className="flex items-center justify-between p-4 sm:p-6">
        <h1 className="text-xl font-semibold text-white sm:text-neutral-900">
          新增貼文
        </h1>

        <nav className="flex items-center gap-4 text-sm">
          <Link className={topLink} href="/admin/posts">
            回文章列表
          </Link>
          <Link className={topLink} href="/">
            回首頁
          </Link>
        </nav>
      </header>

      {/* ✅ 單一白底卡片（滿版寬度 + 內距） */}
      <main className="px-4 pb-6 sm:px-6">
        <article className="w-full rounded border bg-white text-neutral-900 p-4">
          <PostForm />
        </article>
      </main>
    </div>
  );
}