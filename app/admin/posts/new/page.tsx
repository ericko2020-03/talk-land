// path: app/admin/posts/new/page.tsx
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

  // ✅ 不再額外套 container（全站由 layout 統一）
  // ✅ 後台頁統一黑底白字外殼 + 內容白卡（由 PostForm 負責）
  return (
    <div className="space-y-6 bg-black text-white">
      <PostForm />
    </div>
  );
}