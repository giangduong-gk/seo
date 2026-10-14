"use client";

import { PenLine } from "lucide-react";
import { useActionState, useState } from "react";
import { Button, Input, Progress, Select, SystemNotice } from "@/components/ui";
import { createArticle } from "@/app/article-actions";
import type { ActionState } from "@/app/actions";

type BriefOption = { id: string; title: string; targetKeyword: string };

/** Form tạo bài viết mới — từ một brief (khuyên dùng) hoặc từ khoá tự do. `compact` dùng trên trang brief: chỉ một nút nhỏ. */
export function ArticleForm({ projectId, briefs, defaultBriefId, disabled, compact }: { projectId: string; briefs: BriefOption[]; defaultBriefId?: string; disabled?: boolean; compact?: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createArticle, undefined);
  const [briefId, setBriefId] = useState(defaultBriefId ?? "");

  if (compact && defaultBriefId) {
    return (
      <form action={action} style={{ display: "inline-flex", flexDirection: "column", gap: 6 }}>
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="briefId" value={defaultBriefId} />
        <Button type="submit" variant="secondary" size="s" iconLeft={<PenLine size={14} aria-hidden />} loading={pending} disabled={disabled} title={disabled ? "Chưa có ANTHROPIC_API_KEY" : "Tạo bài viết từ brief này rồi mở trình soạn thảo"}>Viết bài</Button>
        {state?.error && !pending && <span className="caption" style={{ color: "var(--danger)" }} role="alert">{state.error}</span>}
      </form>
    );
  }

  return (
    <form action={action} style={{ display: "grid", gap: 14 }}>
      <input type="hidden" name="projectId" value={projectId} />
      <Select name={briefId ? "briefId" : undefined} id="article-brief" label="Content Brief" value={briefId} onChange={(e) => setBriefId(e.target.value)} disabled={disabled || pending} hint={briefs.length === 0 ? "Dự án chưa có brief — bạn vẫn có thể viết từ từ khoá tự do." : "Writer bám outline, E-E-A-T và checklist GEO trong brief."}>
        <option value="">— Không dùng brief —</option>
        {briefs.map((b) => <option key={b.id} value={b.id}>{b.title} · {b.targetKeyword}</option>)}
      </Select>
      {!briefId && (
        <Input name="targetKeyword" label="Từ khoá mục tiêu" placeholder="VD: iphone 17 pro max trả góp 0%" required minLength={2} autoComplete="off" disabled={disabled || pending} hint="Không có brief, Claude sẽ tự dựng outline từ từ khoá và hồ sơ dự án." />
      )}
      {pending && <Progress value={null} label="Đang tạo bài viết và mở trình soạn thảo…" />}
      {state?.error && !pending && <SystemNotice tone="red" title="Không tạo được bài viết">{state.error}</SystemNotice>}
      <div><Button type="submit" variant="primary" iconLeft={<PenLine size={16} aria-hidden />} loading={pending} disabled={disabled}>Viết bài</Button></div>
    </form>
  );
}
