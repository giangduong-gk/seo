"use client";

import { FileText } from "lucide-react";
import { useActionState } from "react";
import { Button, Input, SystemNotice, Textarea } from "@/components/ui";
import { createBrief, type ActionState } from "@/app/actions";
import { PLAN_BRIEF, PendingSteps, useAiFormFeedback } from "@/components/content/PendingSteps";

/**
 * Form tạo Content Brief. `compact` (trang phân tích, editor cluster): chỉ một nút nhỏ + tiến trình một dòng;
 * `defaultKeyword` cố định từ khoá mục tiêu (ẩn ô nhập).
 */
export function BriefForm({ projectId, keywords, disabled, clusterId, nodeId, defaultKeyword, compact }: { projectId: string; keywords?: string[]; disabled?: boolean; clusterId?: string; nodeId?: string; defaultKeyword?: string; compact?: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createBrief, undefined);
  const onSubmit = useAiFormFeedback(state, pending, "Không tạo được brief");
  const listId = `kw-${projectId}-${nodeId ?? "all"}`;
  return (
    <form action={action} onSubmit={onSubmit} style={{ display: "grid", gap: compact ? 8 : 14, minWidth: 0 }} aria-busy={pending || undefined}>
      <input type="hidden" name="projectId" value={projectId} />
      {clusterId && <input type="hidden" name="clusterId" value={clusterId} />}
      {nodeId && <input type="hidden" name="nodeId" value={nodeId} />}
      {defaultKeyword ? (
        <input type="hidden" name="targetKeyword" value={defaultKeyword} />
      ) : (
        <>
          <Input name="targetKeyword" label="Từ khoá mục tiêu" placeholder="VD: iphone 17 pro max trả góp 0%" required minLength={2} list={listId} autoComplete="off" disabled={disabled || pending} hint="Nếu từ khoá đã được phân tích, brief sẽ dùng lại dữ liệu SERP đó." />
          {keywords && keywords.length > 0 && <datalist id={listId}>{keywords.map((k) => <option key={k} value={k} />)}</datalist>}
        </>
      )}
      {!compact && <Textarea name="notes" label="Ghi chú cho brief (tuỳ chọn)" placeholder="VD: nhấn mạnh chương trình trả góp của Giá Kho; độ dài ~1500 từ" rows={2} disabled={disabled || pending} />}
      {pending && !compact && <PendingSteps plan={PLAN_BRIEF} title="Claude đang viết brief" />}
      {state?.error && !pending && (compact
        ? <span className="caption" style={{ color: "var(--danger)", maxWidth: 320 }} role="alert">{state.error}</span>
        : <SystemNotice tone="red" title="Không tạo được brief">{state.error}</SystemNotice>)}
      <div><Button type="submit" variant={compact ? "secondary" : "primary"} size={compact ? "s" : "m"} iconLeft={<FileText size={compact ? 14 : 16} aria-hidden />} loading={pending} disabled={disabled} fullWidth={!compact} title={disabled ? "Chưa có ANTHROPIC_API_KEY" : undefined}>{pending ? "Đang tạo brief…" : "Tạo brief"}</Button></div>
      {pending && compact && <PendingSteps plan={PLAN_BRIEF} compact />}
    </form>
  );
}
