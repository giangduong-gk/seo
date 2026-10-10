import { BarChart3, FolderKanban } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import s from "./Shell.module.css";

export function Wordmark() {
  return (
    <Link href="/" className={s.wordmark} aria-label="SEO Studio — trang chủ">
      <b>SEO</b>&nbsp;Studio
    </Link>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <header className={s.header}>
        <div className={s.inner}>
          <Wordmark />
          <nav className={s.nav} aria-label="Chính">
            <Link href="/" className={s.link}><FolderKanban size={14} aria-hidden /> Dự án</Link>
            <Link href="/usage" className={s.link}><BarChart3 size={14} aria-hidden /> Chi phí AI</Link>
          </nav>
        </div>
      </header>
      <main className={s.main}>{children}</main>
      <footer className={s.footer}>
        <span>SEO Studio · chuẩn SEO/GEO 2026 · chạy trên Claude</span>
        <span>Thiết kế theo AiDoIt Design System v1.13.2</span>
      </footer>
    </>
  );
}
