import type { MouseEventHandler, ReactNode } from "react";
import s from "./Chip.module.css";

type Props = {
  children: ReactNode;
  selected?: boolean;
  muted?: boolean;
  icon?: ReactNode;
  title?: string;
  /** Biến thể bấm được: render <button> với hover/pressed. Tự bật khi có `onClick`. */
  as?: "span" | "button";
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /** Trạng thái bật/tắt (aria-pressed) cho chip dạng toggle; mặc định theo `selected`. */
  pressed?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
};

export function Chip({ children, selected, muted, icon, title, as, onClick, pressed, disabled, type = "button", className }: Props) {
  const interactive = as === "button" || (as == null && onClick != null);
  const cls = [s.chip, selected ? s.selected : "", muted ? s.muted : "", interactive ? s.interactive : "", className ?? ""].join(" ");
  if (interactive) {
    return (
      <button type={type} className={cls} title={title} onClick={onClick} disabled={disabled} aria-pressed={pressed ?? selected ?? undefined}>
        {icon}<span>{children}</span>
      </button>
    );
  }
  return (
    <span className={cls} title={title}>
      {icon}<span>{children}</span>
    </span>
  );
}
