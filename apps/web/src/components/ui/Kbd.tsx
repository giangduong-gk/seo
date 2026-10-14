import type { ReactNode } from "react";

/** Phím tắt dạng chip mono, vd. <Kbd>⌘K</Kbd>. */
export function Kbd({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <kbd title={title} style={{ display: "inline-flex", alignItems: "center", height: 20, padding: "0 6px", borderRadius: "var(--radius-badge)", border: "1px solid var(--line-2)", background: "var(--state-1)", font: "var(--text-mono)", fontSize: 11, color: "var(--fg-2)", whiteSpace: "nowrap" }}>
      {children}
    </kbd>
  );
}
