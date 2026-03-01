// path: app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // 手機黑底，桌機白底
  const pageShell =
    "min-h-screen bg-black text-white sm:bg-white sm:text-neutral-900";

  // ✅ 桌機寬度：至少 1/2 螢幕，但不要無上限
  // - sm: max-w 50vw（半螢幕）
  // - lg: 再 cap 到 max-w-3xl（避免超大螢幕太寬）
  const container =
    "mx-auto w-full max-w-none px-3 py-5 sm:px-6 sm:py-8 sm:max-w-[50vw] lg:max-w-3xl";

  return (
    <html lang="zh-Hant">
      <body
        data-scope="app"
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className={pageShell}>
          <main className={container}>{children}</main>
        </div>
      </body>
    </html>
  );
}