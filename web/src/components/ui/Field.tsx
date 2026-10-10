import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import s from "./Field.module.css";

type Base = { label?: string; hint?: string; error?: string };

export function Input({ label, hint, error, className, id, ...rest }: Base & InputHTMLAttributes<HTMLInputElement>) {
  const inputId = id ?? rest.name;
  return (
    <div className={s.field}>
      {label && <label className={s.label} htmlFor={inputId}>{label}</label>}
      <input id={inputId} className={[s.control, error ? s.invalid : "", className ?? ""].join(" ")} aria-invalid={error ? true : undefined} {...rest} />
      {error ? <span className={s.error}>{error}</span> : hint ? <span className={s.hint}>{hint}</span> : null}
    </div>
  );
}

export function Textarea({ label, hint, error, className, id, ...rest }: Base & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const inputId = id ?? rest.name;
  return (
    <div className={s.field}>
      {label && <label className={s.label} htmlFor={inputId}>{label}</label>}
      <textarea id={inputId} className={[s.control, error ? s.invalid : "", className ?? ""].join(" ")} aria-invalid={error ? true : undefined} {...rest} />
      {error ? <span className={s.error}>{error}</span> : hint ? <span className={s.hint}>{hint}</span> : null}
    </div>
  );
}

export function Select({ label, hint, error, className, id, children, ...rest }: Base & SelectHTMLAttributes<HTMLSelectElement>) {
  const inputId = id ?? rest.name;
  return (
    <div className={s.field}>
      {label && <label className={s.label} htmlFor={inputId}>{label}</label>}
      <select id={inputId} className={[s.control, className ?? ""].join(" ")} {...rest}>{children}</select>
      {error ? <span className={s.error}>{error}</span> : hint ? <span className={s.hint}>{hint}</span> : null}
    </div>
  );
}
