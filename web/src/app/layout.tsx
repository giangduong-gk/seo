import type { Metadata, Viewport } from "next";
import { Archivo, Geist_Mono, Inter } from "next/font/google";
import { Suspense } from "react";
import { BackToTop } from "@/components/nav/BackToTop";
import { NavProgress } from "@/components/nav/NavProgress";
import { Shell } from "@/components/shell/Shell";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin", "vietnamese"], axes: ["wdth"], variable: "--nf-archivo", display: "swap" });
const inter = Inter({ subsets: ["latin", "vietnamese"], variable: "--nf-inter", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--nf-geist-mono", display: "swap" });

export const viewport: Viewport = { themeColor: "#0F1113", colorScheme: "dark", width: "device-width", initialScale: 1, viewportFit: "cover" }; /* lint-allow-color: meta theme-color cần giá trị thật (= --bg-1) */

export const metadata: Metadata = {
  title: { default: "SEO Studio", template: "%s · SEO Studio" },
  description: "Phân tích từ khoá, chủ đề và viết nội dung chuẩn SEO/GEO 2026 với Claude.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={[archivo.variable, inter.variable, geistMono.variable].join(" ")}>
      <body>
        <ToastProvider>
          <Suspense fallback={null}><NavProgress /></Suspense>
          <Shell>{children}</Shell>
          <BackToTop />
        </ToastProvider>
      </body>
    </html>
  );
}
