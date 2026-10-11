"use client";

import { Sparkles } from "lucide-react";
import { useActionState } from "react";
import { Button, Input, SystemNotice } from "@/components/ui";
import { runAnalysis, type ActionState } from "@/app/actions";
import { PLAN_ANALYSIS, PendingSteps, useAiFormFeedback } from "@/components/content/PendingSteps";

export function KeywordForm({ projectId, disabled }: { projectId: string; disabled?: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(runAnalysis, undefined);
  const onSubmit = useAiFormFeedback(state, pending, "Phân tích thất bại");
  return (
    <form action={action} onSubmit={onSubmit} style={{ display: "grid", gap: 12 }} aria-busy={pending || undefined}>
      <input type="hidden" name="projectId" value={projectId} />
      <Input name="term" label="Từ khoá hoặc chủ đề" placeholder="VD: iphone 17 pro max giá bao nhiêu" required minLength={2} disabled={disabled || pending} autoComplete="off" enterKeyHint="go" />
      <Button type="submit" variant="primary" iconLeft={<Sparkles size={16} aria-hidden />} loading={pending} disabled={disabled} fullWidth>
        {pending ? "Đang phân tích…" : "Phân tích"}
      </Button>
      {pending && <PendingSteps plan={PLAN_ANALYSIS} title="Claude đang phân tích từ khoá" />}
      {state?.error && !pending && <SystemNotice tone="red" title="Phân tích thất bại">{state.error}</SystemNotice>}
    </form>
  );
}
