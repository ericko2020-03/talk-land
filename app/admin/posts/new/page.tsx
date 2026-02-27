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

  return (
    <main className="min-h-screen bg-black text-white md:bg-white md:text-neutral-900">
      <div className="mx-auto max-w-2xl px-4 py-6 md:p-6 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">新增貼文</h1>

          <nav className="flex items-center gap-4 text-sm">
            <Link className="underline" href="/admin/posts">
              回文章列表
            </Link>
            <Link className="underline" href="/">
              回首頁
            </Link>
          </nav>
        </header>

        {/* 單一白底卡片：手機/桌機都一致 */}
        <PostForm />
      </div>
    </main>
  );
}