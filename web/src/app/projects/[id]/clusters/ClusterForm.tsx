"use client";

import { Network, Search } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { Button, SystemNotice, Textarea } from "@/components/ui";
import { createCluster, type ActionState } from "@/app/actions";
import { PLAN_CLUSTER, PendingSteps, useAiFormFeedback } from "@/components/content/PendingSteps";
import { IntentBadge } from "../IntentBadge";
import s from "./ClusterForm.module.css";

type K = { id: string; term: string; intent: string | null; analyzed: boolean };

const fold = (x: string) => x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");

export function ClusterForm({ projectId, keywords, disabled }: { projectId: string; keywords: K[]; disabled?: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createCluster, undefined);
  const onSubmit = useAiFormFeedback(state, pending, "Không tạo được cluster");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(keywords.filter((k) => k.analyzed).map((k) => k.id)));
  const [q, setQ] = useState("");
  const toggle = (id: string) => setSelected((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const needle = fold(q.trim());
  const matches = useMemo(() => new Set(keywords.filter((k) => !needle || fold(k.term).includes(needle)).map((k) => k.id)), [keywords, needle]);
  const allVisibleSelected = matches.size > 0 && [...matches].every((id) => selected.has(id));
  const setVisible = (on: boolean) => setSelected((cur) => { const n = new Set(cur); matches.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });
  const locked = disabled || pending;

  return (
    <form action={action} onSubmit={onSubmit} className={s.form} aria-busy={pending || undefined}>
      <input type="hidden" name="projectId" value={projectId} />
      {keywords.length > 0 && (
        <fieldset className={s.fieldset} disabled={locked}>
          <legend className={s.legend}>
            <span>Từ khoá trong dự án</span>
            <span className={s.count} aria-live="polite">đã chọn <b>{selected.size}</b>/{keywords.length}</span>
          </legend>
          <div className={s.tools}>
            {keywords.length > 6 && (
              <label className={s.search}>
                <Search size={14} className={s.searchIcon} aria-hidden />
                <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm từ khoá…" aria-label="Tìm từ khoá trong dự án" autoComplete="off" />
              </label>
            )}
            <button type="button" className={s.link} onClick={() => setVisible(!allVisibleSelected)} disabled={matches.size === 0}>
              {allVisibleSelected ? "Bỏ chọn" : "Chọn tất cả"}{needle ? ` (${matches.size})` : ""}
            </button>
            {selected.size > 0 && !allVisibleSelected && <button type="button" className={s.link} onClick={() => setSelected(new Set())}>Bỏ chọn</button>}
          </div>
          <div className={s.list} tabIndex={0} role="group" aria-label="Danh sách từ khoá">
            {keywords.map((k) => (
              // Hàng bị lọc vẫn nằm trong form (hidden) để từ khoá đã chọn vẫn được gửi
              <label key={k.id} className={s.item} hidden={!matches.has(k.id)}>
                <input type="checkbox" name="keywordIds" value={k.id} checked={selected.has(k.id)} onChange={() => toggle(k.id)} />
                <span className={s.term}>{k.term}</span>
                {k.intent && <span className={s.badge}><IntentBadge intent={k.intent} /></span>}
                {k.analyzed && <span className={s.dot} role="img" title="Đã phân tích" aria-label="Đã phân tích" />}
              </label>
            ))}
            {matches.size === 0 && <p className={s.empty}>Không có từ khoá khớp “{q}”.</p>}
          </div>
          <p className={s.hint}><span className={s.dot} aria-hidden /> đã có phân tích SERP — cluster sẽ dùng lại dữ liệu đó.</p>
        </fieldset>
      )}
      <Textarea name="extraKeywords" label="Thêm từ khoá khác" placeholder={"mỗi dòng một từ khoá, hoặc ngăn cách bằng dấu phẩy\nvd: iphone 17 pro max có mấy màu, so sánh iphone 17 pro và 17 pro max"} rows={3} disabled={locked} />
      <Textarea name="notes" label="Ghi chú định hướng (tuỳ chọn)" placeholder="VD: ưu tiên bài thương mại, tránh chủ đề sửa chữa" rows={2} disabled={locked} />
      {pending && <PendingSteps plan={PLAN_CLUSTER} title="Claude đang quy hoạch cluster" />}
      {state?.error && !pending && <SystemNotice tone="red" title="Không tạo được cluster">{state.error}</SystemNotice>}
      <div className={s.submit}>
        <Button type="submit" variant="primary" iconLeft={<Network size={16} aria-hidden />} loading={pending} disabled={disabled} fullWidth>
          {pending ? "Đang xây cluster…" : `Xây cluster${selected.size ? ` · ${selected.size} từ khoá` : ""}`}
        </Button>
      </div>
    </form>
  );
}
