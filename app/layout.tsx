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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pageShell =
    "min-h-screen bg-black text-white sm:bg-white sm:text-neutral-900";

  // ✅ 手機：滿版（max-w-none）
  // ✅ 桌機：改成較窄（lg:max-w-4xl ≈ 56rem）
  const container =
    "mx-auto w-full max-w-none px-3 py-5 sm:px-4 sm:py-8 lg:px-6 lg:max-w-4xl";

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