// path: app/admin/posts/new/page.tsx
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import PostForm from "./PostForm";

export default async function NewPostPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/api/auth/signin?callbackUrl=/admin/posts/new");
  }

  if ((session.user as any).role !== "ADMIN") {
    redirect("/");
  }

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">後台發文</h1>

        <nav className="flex items-center gap-4 text-sm">
          <Link className="underline" href="/">
            回首頁
          </Link>
          <Link className="underline" href="/">
            回貼文牆
          </Link>
        </nav>
      </header>

      <PostForm />
    </main>
  );
}