import Link from "next/link";
import type { ReactNode } from "react";
import { HeaderFrame } from "./HeaderFrame";
import { NavLinks } from "./NavLinks";
import s from "./Shell.module.css";

export function Wordmark() {
  return (
    <Link href="/" className={s.wordmark} aria-label="RankMind — trang chủ">
      <b>Rank</b>Mind
    </Link>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <a href="#main" className={s.skip}>Bỏ qua tới nội dung</a>
      <HeaderFrame className={s.header}>
        <div className={s.inner}>
          <Wordmark />
          <NavLinks />
        </div>
      </HeaderFrame>
      <main id="main" tabIndex={-1} className={s.main}>{children}</main>
      <footer className={s.footer}>
        <span>RankMind · AI SEO & GEO Content Studio · chạy trên Claude</span>
        <span>Thiết kế theo AiDoIt Design System v1.13.2</span>
      </footer>
    </>
  );
}
