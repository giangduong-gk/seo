"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useToast } from "@/components/ui";
import s from "./PendingSteps.module.css";

export type PendingPlan = {
  /** Tên các bước theo thứ tự. */
  steps: string[];
  /** Giây (tính từ lúc bấm) mà mỗi bước bắt đầu — ước lượng, bước cuối giữ đến khi xong. */
  at: number[];
  /** Ước lượng trung thực, vd "thường 1–3 phút". */
  estimate: string;
  /** Sau bao nhiêu giây thì báo "lâu hơn thường lệ". */
  slowAfter: number;
};

export const PLAN_ANALYSIS: PendingPlan = { steps: ["Đọc SERP", "Phân tích ý định", "Mở rộng ngữ nghĩa", "Đề xuất cluster"], at: [0, 35, 75, 115], estimate: "thường 1–3 phút", slowAfter: 200 };
export const PLAN_CLUSTER: PendingPlan = { steps: ["Đọc từ khoá", "Quy hoạch pillar", "Internal link", "Kiểm tra trùng lặp"], at: [0, 15, 50, 80], estimate: "thường 1–2 phút", slowAfter: 150 };
export const PLAN_BRIEF: PendingPlan = { steps: ["Tổng hợp dữ liệu", "Outline", "E-E-A-T & schema", "FAQ"], at: [0, 15, 50, 85], estimate: "thường 1–2 phút", slowAfter: 150 };

const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

function useElapsed() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return elapsed;
}

/**
 * Phản hồi cho tác vụ AI dài: danh sách bước tiến theo lịch ước lượng + đồng hồ mm:ss + ước lượng trung thực.
 * Bước cuối không bao giờ tự "xong" — chỉ kết thúc khi server trả về (component unmount). `compact` → một dòng.
 */
export function PendingSteps({ plan, title = "Claude đang xử lý", compact }: { plan: PendingPlan; title?: string; compact?: boolean }) {
  const elapsed = useElapsed();
  const idx = plan.at.reduce((acc, start, i) => (elapsed >= start ? i : acc), 0);
  const slow = elapsed >= plan.slowAfter;

  if (compact) {
    return (
      <div className={s.compact} role="status" aria-live="polite">
        <span className={s.pulse} aria-hidden />
        <span className={s.compactLabel}>Bước {idx + 1}/{plan.steps.length} · {plan.steps[idx]}</span>
        <span className={s.timer} aria-label={`Đã chạy ${mmss(elapsed)}`}>{mmss(elapsed)}</span>
      </div>
    );
  }

  return (
    <div className={s.box}>
      <div className={s.head}>
        <span className={s.pulse} aria-hidden />
        <span className={s.title}>{title}</span>
        <span className={s.timer} aria-label={`Đã chạy ${mmss(elapsed)}`}>{mmss(elapsed)}</span>
      </div>
      <ol className={s.steps} aria-live="polite">
        {plan.steps.map((label, i) => {
          const state = i < idx ? "done" : i === idx ? "active" : "todo";
          return (
            <li key={label} className={s.step} data-state={state} aria-current={state === "active" ? "step" : undefined}>
              <span className={s.mark} aria-hidden>{state === "done" ? <Check size={12} strokeWidth={3} /> : null}</span>
              <span>{label}</span>
              {state === "active" && <span className="sr-only">(đang chạy)</span>}
            </li>
          );
        })}
      </ol>
      <p className={s.foot}>
        {slow ? "Lâu hơn thường lệ — Claude vẫn đang chạy, đừng tải lại trang." : `${plan.estimate[0].toUpperCase()}${plan.estimate.slice(1)} · bước hiển thị theo ước lượng. Đừng tải lại trang.`}
      </p>
    </div>
  );
}

/**
 * Hành vi chung của form gọi AI: toast lỗi (kèm thông báo inline sẵn có) và chặn bấm gửi lần hai khi đang chạy.
 * Trả về handler `onSubmit` để gắn vào <form>.
 */
export function useAiFormFeedback(state: { error?: string } | undefined, pending: boolean, errorTitle: string) {
  const { toast } = useToast();
  const shown = useRef<object | undefined>(undefined);
  const busy = useRef(false);
  useEffect(() => { if (!pending) busy.current = false; }, [pending]);
  useEffect(() => {
    if (!pending && state?.error && shown.current !== state) {
      shown.current = state;
      toast({ title: errorTitle, description: state.error, tone: "error" });
    }
  }, [state, pending, errorTitle, toast]);
  return (e: FormEvent<HTMLFormElement>) => {
    if (pending || busy.current) { e.preventDefault(); return; }
    busy.current = true;
  };
}
