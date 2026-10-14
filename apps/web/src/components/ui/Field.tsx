"use client";

import { useCallback, useLayoutEffect, useRef, useState, type ChangeEvent, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import s from "./Field.module.css";

type Base = {
  label?: string;
  hint?: string;
  error?: string;
  /** Hiện bộ đếm ký tự "n/maxLength" (cần `maxLength`). */
  showCount?: boolean;
};

const useIsoLayoutEffect = typeof window === "undefined" ? () => {} : useLayoutEffect;

function setRef<T>(ref: Ref<T> | undefined, v: T | null) {
  if (typeof ref === "function") ref(v);
  else if (ref && typeof ref === "object") (ref as { current: T | null }).current = v;
}

function Foot({ id, error, hint, count, max }: { id: string; error?: string; hint?: string; count?: number; max?: number }) {
  const showCount = count != null && max != null;
  if (!error && !hint && !showCount) return null;
  const near = showCount && count >= max * 0.9;
  return (
    <div className={s.foot}>
      {error ? <span id={id ? `${id}-msg` : undefined} className={s.error}>{error}</span> : hint ? <span id={id ? `${id}-msg` : undefined} className={s.hint}>{hint}</span> : <span />}
      {showCount && <span className={[s.count, near ? s.countNear : ""].join(" ")} aria-live="polite">{count}/{max}</span>}
    </div>
  );
}

function initialLength(v: unknown): number {
  return v == null ? 0 : String(v).length;
}

function useCounter(enabled: boolean, value: unknown, defaultValue: unknown) {
  const [len, setLen] = useState(() => initialLength(value ?? defaultValue));
  const controlledLen = value != null ? initialLength(value) : null;
  const onChange = useCallback((n: number) => { if (enabled) setLen(n); }, [enabled]);
  return { count: enabled ? (controlledLen ?? len) : undefined, onChange };
}

export function Input({ label, hint, error, showCount, className, id, ref, onChange, ...rest }: Base & InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  const inputId = id ?? rest.name ?? "";
  const counter = useCounter(Boolean(showCount && rest.maxLength), rest.value, rest.defaultValue);
  return (
    <div className={s.field}>
      {label && <label className={s.label} htmlFor={inputId || undefined}>{label}</label>}
      <input
        id={inputId || undefined} ref={ref}
        className={[s.control, error ? s.invalid : "", className ?? ""].join(" ")}
        aria-invalid={error ? true : undefined} aria-describedby={inputId && (error || hint) ? `${inputId}-msg` : undefined}
        onChange={(e: ChangeEvent<HTMLInputElement>) => { counter.onChange(e.currentTarget.value.length); onChange?.(e); }}
        {...rest}
      />
      <Foot id={inputId} error={error} hint={hint} count={counter.count} max={rest.maxLength} />
    </div>
  );
}

type TextareaProps = Base & TextareaHTMLAttributes<HTMLTextAreaElement> & {
  ref?: Ref<HTMLTextAreaElement>;
  /** Tự giãn theo nội dung (không thanh cuộn) tới `maxHeight`. */
  autoGrow?: boolean;
  /** Chiều cao tối đa khi autoGrow (px), mặc định 480. */
  maxHeight?: number;
};

export function Textarea({ label, hint, error, showCount, autoGrow, maxHeight = 480, className, id, ref, onChange, style, ...rest }: TextareaProps) {
  const inputId = id ?? rest.name ?? "";
  const el = useRef<HTMLTextAreaElement | null>(null);
  const counter = useCounter(Boolean(showCount && rest.maxLength), rest.value, rest.defaultValue);

  const fit = useCallback(() => {
    const t = el.current;
    if (!t || !autoGrow) return;
    t.style.height = "auto";
    const h = Math.min(t.scrollHeight + (t.offsetHeight - t.clientHeight), maxHeight);
    t.style.height = `${h}px`;
    t.style.overflowY = t.scrollHeight + (t.offsetHeight - t.clientHeight) > maxHeight ? "auto" : "hidden";
  }, [autoGrow, maxHeight]);

  // Giá trị điều khiển từ ngoài (streaming, reset form) → co giãn lại
  useIsoLayoutEffect(() => { fit(); }, [fit, rest.value]);

  return (
    <div className={s.field}>
      {label && <label className={s.label} htmlFor={inputId || undefined}>{label}</label>}
      <textarea
        id={inputId || undefined}
        ref={(node) => { el.current = node; setRef(ref, node); }}
        className={[s.control, autoGrow ? s.autoGrow : "", error ? s.invalid : "", className ?? ""].join(" ")}
        aria-invalid={error ? true : undefined} aria-describedby={inputId && (error || hint) ? `${inputId}-msg` : undefined}
        style={autoGrow ? { maxHeight, ...style } : style}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => { counter.onChange(e.currentTarget.value.length); fit(); onChange?.(e); }}
        {...rest}
      />
      <Foot id={inputId} error={error} hint={hint} count={counter.count} max={rest.maxLength} />
    </div>
  );
}

export function Select({ label, hint, error, className, id, children, ref, ...rest }: Omit<Base, "showCount"> & SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement>; children?: ReactNode }) {
  const inputId = id ?? rest.name ?? "";
  return (
    <div className={s.field}>
      {label && <label className={s.label} htmlFor={inputId || undefined}>{label}</label>}
      <select id={inputId || undefined} ref={ref} className={[s.control, error ? s.invalid : "", className ?? ""].join(" ")} aria-invalid={error ? true : undefined} aria-describedby={inputId && (error || hint) ? `${inputId}-msg` : undefined} {...rest}>{children}</select>
      <Foot id={inputId} error={error} hint={hint} />
    </div>
  );
}
