import type { ButtonHTMLAttributes, ReactNode } from "react";
import s from "./Button.module.css";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "s" | "m" | "l";
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
  /** Đang xử lý: khoá nút, hiện spinner — giữ nguyên bề rộng (không nhảy layout). */
  loading?: boolean;
  /** Gợi ý phím tắt hiển thị bên phải, vd. "⌘↵" (chỉ hiển thị; ẩn trên màn hình cảm ứng). */
  kbd?: ReactNode;
};

/** Nút hành động — primary (Volt) tối đa một lần mỗi vùng quyết định. */
export function Button({ variant = "secondary", size = "m", iconLeft, iconRight, fullWidth, loading, kbd, className, children, disabled, ...rest }: Props) {
  const cls = [s.btn, s[variant], size !== "m" ? s[size] : "", fullWidth ? s.full : "", loading ? s.loading : "", className ?? ""].join(" ");
  return (
    <button className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {iconLeft ? (
        // Icon và spinner chung một ô lưới → đổi qua lại không đổi bề rộng
        <span className={s.slot}>
          <span className={s.slotIcon}>{iconLeft}</span>
          {loading && <span className={s.spinner} aria-hidden />}
        </span>
      ) : loading ? (
        <span className={s.overlay} aria-hidden><span className={s.spinner} /></span>
      ) : null}
      {children != null && children !== false && <span className={s.label}>{children}</span>}
      {iconRight}
      {kbd != null && <kbd className={s.kbd}>{kbd}</kbd>}
    </button>
  );
}
