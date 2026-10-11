"use client";

import { BarChart3, FolderKanban } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import s from "./Shell.module.css";

const LINKS = [
  { href: "/", label: "Dự án", Icon: FolderKanban, match: (p: string) => p === "/" || p.startsWith("/projects") },
  { href: "/usage", label: "Chi phí AI", Icon: BarChart3, match: (p: string) => p.startsWith("/usage") },
];

/** Điều hướng chính với trạng thái đang chọn (aria-current="page"). */
export function NavLinks() {
  const pathname = usePathname() ?? "/";
  return (
    <nav className={s.nav} aria-label="Chính">
      {LINKS.map(({ href, label, Icon, match }) => {
        const active = match(pathname);
        return (
          <Link key={href} href={href} className={[s.link, active ? s.active : ""].join(" ")} aria-current={active ? "page" : undefined}>
            <Icon size={15} aria-hidden className={s.linkIcon} /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
