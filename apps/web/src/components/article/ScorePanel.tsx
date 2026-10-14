"use client";

import { CircleAlert, CircleCheck, CircleX, Gauge, Wrench } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, EmptyState } from "@/components/ui";
import type { ScoreCriterion, ScoreReport } from "@/lib/schemas";
import s from "./ArticleEditor.module.css";
import { useCountUp } from "./hooks";
import { Section } from "./Section";
import { scoreTone } from "./status";

export type ScoreView = ScoreReport & { id: string; createdAt: string };
type Filter = "fix" | "pass" | "all";

const ICON = { pass: CircleCheck, warn: CircleAlert, fail: CircleX } as const;
const STATUS_TEXT = { pass: "Đạt", warn: "Cần cải thiện", fail: "Không đạt" } as const;
const ORDER = { fail: 0, warn: 1, pass: 2 } as const;

function ScoreRow({ label, value }: { label: string; value: number }) {
  const v = useCountUp(value);
  const tone = scoreTone(value);
  return (
    <div className={s.scoreRow}>
      <div className={s.scoreMeta}>
        <span className={s.scoreLabel}>{label}</span>
        <div className={s.scoreTrack} role="progressbar" aria-label={`Điểm ${label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
          <div className={[s.scoreFill, s[`fill_${tone}`]].join(" ")} style={{ transform: `scaleX(${Math.max(0, Math.min(100, v)) / 100})` }} />
        </div>
      </div>
      <span className={[s.scoreNum, s[tone]].join(" ")} aria-hidden>{Math.round(v)}</span>
    </div>
  );
}

function Reason({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [clamped, setClamped] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => { if (!open) setClamped(el.scrollHeight > el.clientHeight + 1); };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, open]);
  return (
    <div className={s.reasonWrap}>
      <div ref={ref} className={["caption", s.reason, open ? s.reasonOpen : ""].join(" ")}>{text}</div>
      {(clamped || open) && <button type="button" className={s.moreBtn} onClick={() => setOpen((o) => !o)}>{open ? "Thu gọn" : "Xem thêm"}</button>}
    </div>
  );
}

function Criterion({ c, onFix, fixDisabled, fixing }: { c: ScoreCriterion; onFix: (c: ScoreCriterion) => void; fixDisabled: boolean; fixing: boolean }) {
  const Icon = ICON[c.status];
  const cls = c.status === "pass" ? s.pass : c.status === "warn" ? s.warn : s.fail;
  return (
    <li className={[s.crit, fixing ? s.critFixing : ""].join(" ")} aria-busy={fixing || undefined}>
      <Icon size={16} className={cls} aria-label={STATUS_TEXT[c.status]} />
      <div style={{ minWidth: 0 }}>
        <div className={s.critHead}>
          <span className={s.critLabel}>{c.label}</span>
          <Badge tone="outline" title="Trọng số">×{c.weight}</Badge>
          {c.source === "ai" && <Badge tone="info">AI</Badge>}
        </div>
        {c.reason && <Reason text={c.reason} />}
        {c.status !== "pass" && c.fix && (
          <div className={s.critAction}>
            <Button size="s" variant="secondary" className={s.tap} iconLeft={<Wrench size={13} aria-hidden />} onClick={() => onFix(c)} loading={fixing} disabled={fixDisabled && !fixing} title={c.fix}>{fixing ? "Đang sửa…" : "Sửa"}</Button>
          </div>
        )}
      </div>
    </li>
  );
}

function Group({ title, all, items, onFix, fixDisabled, fixingId }: { title: string; all: ScoreCriterion[]; items: ScoreCriterion[]; onFix: (c: ScoreCriterion) => void; fixDisabled: boolean; fixingId: string | null }) {
  if (all.length === 0 || items.length === 0) return null;
  return (
    <div>
      <div className={["micro", s.groupHead].join(" ")}><span>{title}</span><span className="mono">{all.filter((c) => c.status === "pass").length}/{all.length} đạt</span></div>
      <ul className={s.critList}>{items.map((c) => <Criterion key={c.id} c={c} onFix={onFix} fixDisabled={fixDisabled} fixing={fixingId === c.id} />)}</ul>
    </div>
  );
}

export function ScorePanel({ score, scoring, streaming, canGenerate, fixingId, onScore, onFix }: {
  score: ScoreView | null; scoring: boolean; streaming: boolean; canGenerate: boolean; fixingId: string | null;
  onScore: (withAi: boolean) => void; onFix: (c: ScoreCriterion) => void;
}) {
  const fixDisabled = streaming || scoring || !canGenerate;
  const criteria = useMemo(() => [...(score?.criteria ?? [])].sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.weight - a.weight), [score]);
  const nFix = criteria.filter((c) => c.status !== "pass").length;
  const nPass = criteria.length - nFix;
  const [filter, setFilter] = useState<Filter>(nFix > 0 ? "fix" : "all");
  // Lần chấm mới: quay về "Cần sửa" nếu còn tiêu chí chưa đạt
  const scoreId = score?.id;
  useEffect(() => { setFilter(nFix > 0 ? "fix" : "all"); }, [scoreId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!score) {
    return (
      <Section title="Điểm SEO / GEO" sub="chưa chấm" defaultOpen>
        <EmptyState icon={<Gauge size={22} />} title="Chưa chấm điểm" text="Rule engine chấm SEO ngay, không tốn token; bật AI để chấm thêm GEO / E-E-A-T." action={<Button size="s" variant="secondary" className={s.tap} onClick={() => onScore(false)} loading={scoring} disabled={streaming}>Chấm ngay (rule)</Button>} />
      </Section>
    );
  }

  const visible = criteria.filter((c) => filter === "all" || (filter === "fix" ? c.status !== "pass" : c.status === "pass"));
  const seoAll = criteria.filter((c) => c.group === "seo");
  const geoAll = criteria.filter((c) => c.group === "geo");
  const when = new Date(score.createdAt);
  const chips: [Filter, string, number][] = [["fix", "Cần sửa", nFix], ["pass", "Đạt", nPass], ["all", "Tất cả", criteria.length]];

  return (
    <Section title="Điểm SEO / GEO" sub={scoring ? "đang chấm…" : `${nFix} cần sửa`} defaultOpen>
      <div className={[s.scores, scoring ? s.scoresBusy : ""].join(" ")}>
        <ScoreRow label="SEO" value={score.seoScore} />
        <ScoreRow label="GEO" value={score.geoScore} />
      </div>
      {score.summary && <p className="body-s secondary">{score.summary}</p>}
      <div className={s.scoreFoot}>
        <span className="caption mono">{score.model ? `${score.model} · ` : "rule engine · "}{when.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</span>
        <button type="button" className={s.linkBtn} onClick={() => onScore(true)} disabled={scoring || streaming || !canGenerate} title={canGenerate ? "Chấm lại bằng rule engine + Claude" : "Chưa có ANTHROPIC_API_KEY"}>Chấm lại (có AI)</button>
      </div>

      {criteria.length > 0 && (
        <div className={s.chips} role="group" aria-label="Lọc tiêu chí">
          {chips.map(([k, label, n]) => (
            <button key={k} type="button" className={[s.chip, filter === k ? s.chipOn : ""].join(" ")} aria-pressed={filter === k} onClick={() => setFilter(k)} disabled={n === 0 && k !== "all"}>
              {label}<span className={s.chipCount}>{n}</span>
            </button>
          ))}
        </div>
      )}

      <div key={filter} className={s.fadeIn}>
        {visible.length === 0 ? (
          <p className="caption">{filter === "fix" ? "Mọi tiêu chí đều đạt — tuyệt vời." : "Chưa có tiêu chí nào đạt."}</p>
        ) : (
          <div className={s.groups}>
            <Group title="SEO (rule)" all={seoAll} items={visible.filter((c) => c.group === "seo")} onFix={onFix} fixDisabled={fixDisabled} fixingId={fixingId} />
            <Group title="GEO" all={geoAll} items={visible.filter((c) => c.group === "geo")} onFix={onFix} fixDisabled={fixDisabled} fixingId={fixingId} />
          </div>
        )}
      </div>
      {geoAll.length === 0 && <p className="caption">Chưa có tiêu chí GEO — bấm “Chấm lại (có AI)” để Claude đánh giá answer-first, citability, E-E-A-T.</p>}
    </Section>
  );
}
