import type { ButtonHTMLAttributes, ReactNode } from "react";
import s from "./Button.module.css";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "s" | "m" | "l";
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
  loading?: boolean;
};

/** Nút hành động — primary (Volt) tối đa một lần mỗi vùng quyết định. */
export function Button({ variant = "secondary", size = "m", iconLeft, iconRight, fullWidth, loading, className, children, disabled, ...rest }: Props) {
  const cls = [s.btn, s[variant], size !== "m" ? s[size] : "", fullWidth ? s.full : "", className ?? ""].join(" ");
  return (
    <button className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <span className={s.spinner} aria-hidden /> : iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
