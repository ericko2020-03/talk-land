// path: app/admin/posts/[id]/edit/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertAdmin, assertActive } from "@/lib/rbac";
import EditPostForm from "./EditPostForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Visibility = "PUBLIC" | "LOGIN_ONLY" | "ADMIN_ONLY" | "ADMIN_DRAFT";

export default async function AdminEditPostPage({
  params,
}: {
  params: { id?: string } | Promise<{ id?: string }>;
}) {
  const resolved = await Promise.resolve(params as any);
  const id = String(resolved?.id ?? "").trim();
  if (!id) redirect("/admin/posts");

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(`/admin/posts/${id}/edit`)}`);
  }

  const role = (session.user as any).role;
  const status = (session.user as any).status;

  try {
    assertActive(status);
    assertAdmin(role);
  } catch {
    redirect("/");
  }

  const post = await prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      content: true,
      youtubeUrl: true,
      visibility: true,
      deletedAt: true,
      media: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, url: true, type: true },
      },
    },
  });

  if (!post || post.deletedAt) {
    return (
      <main className="mx-auto max-w-2xl p-6 space-y-4">
        <div>找不到貼文或已刪除</div>
        <Link className="underline" href="/admin/posts">
          回文章列表
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">編輯貼文</h1>
        <nav className="flex items-center gap-4 text-sm">
          <Link className="underline" href="/admin/posts">
            回文章列表
          </Link>
          <Link className="underline" href={`/post/${post.id}`}>
            前台查看
          </Link>
        </nav>
      </header>

      <EditPostForm
        key={post.id}
        postId={post.id}
        initialContent={post.content}
        initialYoutubeUrl={post.youtubeUrl ?? ""}
        initialVisibility={post.visibility as Visibility}
        initialMedia={post.media}
      />
    </main>
  );
}