"use client";

import { CircleAlert, CircleCheck, Info, LoaderCircle, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import s from "./Toast.module.css";

export type ToastTone = "success" | "error" | "info" | "progress";
export type ToastOptions = { title: string; description?: string; tone?: ToastTone; duration?: number; id?: string };
type Item = Required<Pick<ToastOptions, "title" | "tone">> & { id: string; description?: string; leaving?: boolean };

type Ctx = { toast: (o: ToastOptions) => string; dismiss: (id: string) => void };
const ToastContext = createContext<Ctx | null>(null);

/**
 * Thông báo ngắn kiểu DS (States → Success/Error/Progress): góc phải dưới trên desktop, giữa đáy trên điện thoại.
 * `toast({ id })` với id cũ → cập nhật tại chỗ (vd. progress → success).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 200);
    const t = timers.current.get(id); if (t) clearTimeout(t); timers.current.delete(id);
  }, []);

  const toast = useCallback((o: ToastOptions) => {
    const id = o.id ?? Math.random().toString(36).slice(2);
    const tone = o.tone ?? "success";
    setItems((xs) => {
      const next: Item = { id, title: o.title, description: o.description, tone };
      const i = xs.findIndex((x) => x.id === id);
      if (i >= 0) { const c = xs.slice(); c[i] = next; return c; }
      return [...xs.slice(-3), next];
    });
    const old = timers.current.get(id); if (old) clearTimeout(old);
    const duration = o.duration ?? (tone === "progress" ? 0 : tone === "error" ? 6000 : 3200);
    if (duration > 0) timers.current.set(id, setTimeout(() => dismiss(id), duration));
    return id;
  }, [dismiss]);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={s.viewport} role="region" aria-label="Thông báo" aria-live="polite">
        {items.map((t) => {
          const Icon = t.tone === "error" ? CircleAlert : t.tone === "info" ? Info : t.tone === "progress" ? LoaderCircle : CircleCheck;
          return (
            <div key={t.id} className={[s.toast, s[t.tone], t.leaving ? s.leaving : ""].join(" ")} role={t.tone === "error" ? "alert" : "status"}>
              <Icon size={16} className={s.icon} aria-hidden />
              <div className={s.body}><div className={s.title}>{t.title}</div>{t.description && <div className={s.desc}>{t.description}</div>}</div>
              <button className={s.close} onClick={() => dismiss(t.id)} aria-label="Đóng thông báo"><X size={14} /></button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/** Dùng trong client component: `const { toast } = useToast(); toast({ title: "Đã lưu" })`. An toàn khi thiếu Provider (no-op). */
export function useToast(): Ctx {
  return useContext(ToastContext) ?? { toast: () => "", dismiss: () => {} };
}
