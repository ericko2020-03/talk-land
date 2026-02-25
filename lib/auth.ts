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
    },

    async jwt({ token }) {
      if (!token.email) return token;

      const dbUser = await prisma.user.findUnique({
        where: { email: String(token.email) },
      });

      if (dbUser) {
        (token as any).uid = dbUser.id;
        (token as any).role = dbUser.role;
        (token as any).status = dbUser.status;
      }
      return token;
    },

    async session({ session, token }) {
      (session.user as any).id = (token as any).uid;
      (session.user as any).role = (token as any).role;
      (session.user as any).status = (token as any).status;
      return session;
    },
  },
};