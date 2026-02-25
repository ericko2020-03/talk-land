// path: app/admin/posts/new/page.tsx
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
    <main className="mx-auto max-w-2xl p-6 space-y-4">
      <h1 className="text-xl font-semibold">後台發文</h1>
      <PostForm />
    </main>
  );
}