import type { ReactNode } from "react";
import s from "./Chip.module.css";

export function Chip({ children, selected, muted, icon, title }: { children: ReactNode; selected?: boolean; muted?: boolean; icon?: ReactNode; title?: string }) {
  return (
    <span className={[s.chip, selected ? s.selected : "", muted ? s.muted : ""].join(" ")} title={title}>
      {icon}<span>{children}</span>
    </span>
  );
}
