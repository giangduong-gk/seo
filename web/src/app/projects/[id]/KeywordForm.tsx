"use client";

import { Sparkles } from "lucide-react";
import { useActionState } from "react";
import { Button, Input, Progress, SystemNotice } from "@/components/ui";
import { runAnalysis, type ActionState } from "@/app/actions";

export function KeywordForm({ projectId, disabled }: { projectId: string; disabled?: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(runAnalysis, undefined);
  return (
    <form action={action} style={{ display: "grid", gap: 12 }}>
      <input type="hidden" name="projectId" value={projectId} />
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <Input name="term" label="Từ khoá hoặc chủ đề" placeholder="VD: iphone 17 pro max giá bao nhiêu" required minLength={2} disabled={disabled || pending} autoComplete="off" />
        </div>
        <Button type="submit" variant="primary" iconLeft={<Sparkles size={16} aria-hidden />} loading={pending} disabled={disabled} style={{ flex: "none" }}>
          {pending ? "Đang phân tích…" : "Phân tích"}
        </Button>
      </div>
      {pending && <Progress value={null} label="Claude đang đọc SERP và phân tích ý định, thực thể, cluster… (1–3 phút)" />}
      {state?.error && !pending && <SystemNotice tone="red" title="Phân tích thất bại">{state.error}</SystemNotice>}
    </form>
  );
}
