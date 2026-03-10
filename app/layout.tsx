// path: app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import MobileCurtainFrame from "@/app/components/mobile/MobileCurtainFrame";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Allensay_s 社群",
  description: "Allensay_s membership community",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  const pageShell =
    "min-h-screen bg-black text-white sm:bg-white sm:text-neutral-900";

  // ✅ 手機：滿版（max-w-none）
  // ✅ 桌機：半螢幕寬（50vw），並在大螢幕 cap 到 3xl 避免太寬
  const container =
    "mx-auto w-full max-w-none px-3 py-5 sm:px-6 sm:py-8 sm:max-w-[50vw] lg:max-w-3xl";

  return (
    <html lang="zh-Hant">
      <body
        data-scope="app"
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className={pageShell}>
          <MobileCurtainFrame isAdmin={isAdmin} containerClassName={container}>
            {children}
          </MobileCurtainFrame>
        </div>
      </body>
    </html>
  );
}