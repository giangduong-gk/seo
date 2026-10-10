"use client";

import { Network } from "lucide-react";
import { useActionState, useState } from "react";
import { Button, Progress, SystemNotice, Textarea } from "@/components/ui";
import { createCluster, type ActionState } from "@/app/actions";
import { IntentBadge } from "../IntentBadge";

type K = { id: string; term: string; intent: string | null; analyzed: boolean };

export function ClusterForm({ projectId, keywords, disabled }: { projectId: string; keywords: K[]; disabled?: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createCluster, undefined);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(keywords.filter((k) => k.analyzed).map((k) => k.id)));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <form action={action} style={{ display: "grid", gap: 14 }}>
      <input type="hidden" name="projectId" value={projectId} />
      {keywords.length > 0 && (
        <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 6 }}>
          <legend className="caption" style={{ marginBottom: 6 }}>Từ khoá trong dự án · đã chọn {selected.size}</legend>
          <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid var(--line-1)", borderRadius: "var(--radius-m)" }}>
            {keywords.map((k) => (
              <label key={k.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid var(--line-1)", cursor: "pointer", minHeight: 40 }}>
                <input type="checkbox" name="keywordIds" value={k.id} checked={selected.has(k.id)} onChange={() => toggle(k.id)} disabled={disabled || pending} style={{ accentColor: "var(--volt)", width: 16, height: 16 }} />
                <span style={{ flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.term}</span>
                {k.intent && <span style={{ flex: "none" }}><IntentBadge intent={k.intent} /></span>}
                {k.analyzed && <span title="Đã phân tích" aria-label="Đã phân tích" style={{ flex: "none", width: 8, height: 8, borderRadius: "50%", background: "var(--volt)" }} />}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <Textarea name="extraKeywords" label="Thêm từ khoá khác" placeholder={"mỗi dòng một từ khoá, hoặc ngăn cách bằng dấu phẩy\nvd: iphone 17 pro max có mấy màu, so sánh iphone 17 pro và 17 pro max"} rows={3} disabled={disabled || pending} />
      <Textarea name="notes" label="Ghi chú định hướng (tuỳ chọn)" placeholder="VD: ưu tiên bài thương mại, tránh chủ đề sửa chữa" rows={2} disabled={disabled || pending} />
      {pending && <Progress value={null} label="Claude đang quy hoạch pillar, cluster, internal link… (1–2 phút)" />}
      {state?.error && !pending && <SystemNotice tone="red" title="Không tạo được cluster">{state.error}</SystemNotice>}
      <div><Button type="submit" variant="primary" iconLeft={<Network size={16} aria-hidden />} loading={pending} disabled={disabled}>Xây cluster</Button></div>
    </form>
  );
}
