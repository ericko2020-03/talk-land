// path: lib/auth.ts
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;

      try {
        const existing = await prisma.user.findUnique({
          where: { email: user.email },
        });

        if (!existing) {
          await prisma.user.create({
            data: {
              email: user.email,
              name: user.name ?? null,
              avatarUrl: user.image ?? null,
              role: "USER",
              status: "ACTIVE",
            },
          });
        } else {
          await prisma.user.update({
            where: { email: user.email },
            data: {
              name: user.name ?? existing.name,
              avatarUrl: user.image ?? existing.avatarUrl,
            },
          });
        }
        return true;
      } catch (e) {
        // DB 掛了就先拒絕登入（避免讓 session/jwt 流程進入不一致狀態）
        console.error("[auth][signIn] db error:", e);
        return false;
      }
    },

    async jwt({ token }) {
      if (!token.email) return token;

      try {
        const dbUser = await prisma.user.findUnique({
          where: { email: String(token.email) },
        });

        if (dbUser) {
          (token as any).uid = dbUser.id;
          (token as any).role = dbUser.role;
          (token as any).status = dbUser.status;
        }
        return token;
      } catch (e) {
        // ✅ 關鍵：不要 throw，讓 getServerSession 不要炸
        console.error("[auth][jwt] db error:", e);
        return token;
      }
    },

    async session({ session, token }) {
      try {
        (session.user as any).id = (token as any).uid ?? null;
        (session.user as any).role = (token as any).role ?? null;
        (session.user as any).status = (token as any).status ?? null;
        return session;
      } catch (e) {
        console.error("[auth][session] error:", e);
        return session;
      }
    },
  },
};