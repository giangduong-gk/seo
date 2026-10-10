import Link from "next/link";
import s from "./SubNav.module.css";

export type SubNavItem = { href: string; label: string; count?: number; active?: boolean };

/** Tabs variant="underline" — điều hướng các mục trong một dự án. */
export function SubNav({ items }: { items: SubNavItem[] }) {
  return (
    <nav className={s.nav} aria-label="Mục trong dự án">
      {items.map((it) => (
        <Link key={it.href} href={it.href} className={[s.item, it.active ? s.active : ""].join(" ")} aria-current={it.active ? "page" : undefined}>
          {it.label}{it.count != null && <span className={s.count}>{it.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
