"use client";

import { CircleAlert, CircleCheck, CircleX, Gauge, Wrench } from "lucide-react";
import { Badge, Button, EmptyState, Panel, Progress } from "@/components/ui";
import type { ScoreCriterion, ScoreReport } from "@/lib/schemas";
import s from "./ArticleEditor.module.css";
import { scoreTone } from "./status";

export type ScoreView = ScoreReport & { id: string; createdAt: string };

const ICON = { pass: CircleCheck, warn: CircleAlert, fail: CircleX } as const;

function Criterion({ c, onFix, fixDisabled }: { c: ScoreCriterion; onFix: (fix: string) => void; fixDisabled: boolean }) {
  const Icon = ICON[c.status];
  const cls = c.status === "pass" ? s.pass : c.status === "warn" ? s.warn : s.fail;
  return (
    <li className={s.crit}>
      <Icon size={16} className={cls} aria-label={c.status === "pass" ? "Đạt" : c.status === "warn" ? "Cần cải thiện" : "Không đạt"} />
      <div style={{ minWidth: 0 }}>
        <div className={s.critHead}>
          <span className={s.critLabel}>{c.label}</span>
          <Badge tone="outline" title="Trọng số">×{c.weight}</Badge>
          {c.source === "ai" && <Badge tone="info">AI</Badge>}
        </div>
        {c.reason && <div className="caption" style={{ marginTop: 2 }}>{c.reason}</div>}
        {c.status !== "pass" && c.fix && (
          <div style={{ marginTop: 6 }}>
            <Button size="s" variant="secondary" iconLeft={<Wrench size={13} aria-hidden />} onClick={() => onFix(c.fix)} disabled={fixDisabled} title={c.fix}>Sửa</Button>
          </div>
        )}
      </div>
    </li>
  );
}

export function ScorePanel({ score, scoring, streaming, canGenerate, onScore, onFix }: { score: ScoreView | null; scoring: boolean; streaming: boolean; canGenerate: boolean; onScore: (withAi: boolean) => void; onFix: (fix: string) => void }) {
  const fixDisabled = streaming || scoring || !canGenerate;
  if (!score) {
    return (
      <Panel title="Điểm SEO / GEO">
        <EmptyState icon={<Gauge size={22} />} title="Chưa chấm điểm" text="Rule engine chấm SEO ngay không tốn token; bật AI để chấm thêm GEO / E-E-A-T." action={<Button size="s" variant="secondary" onClick={() => onScore(false)} loading={scoring} disabled={streaming}>Chấm ngay (rule)</Button>} />
      </Panel>
    );
  }
  const seo = score.criteria.filter((c) => c.group === "seo");
  const geo = score.criteria.filter((c) => c.group === "geo");
  const when = new Date(score.createdAt);
  return (
    <Panel title="Điểm SEO / GEO" sub={scoring ? "đang chấm…" : undefined} action={
      <button type="button" className={s.linkBtn} onClick={() => onScore(true)} disabled={scoring || streaming || !canGenerate} title={canGenerate ? "Chấm lại bằng rule engine + Claude" : "Chưa có ANTHROPIC_API_KEY"}>Chấm lại (có AI)</button>
    }>
      <div className={s.scores}>
        {([["SEO", score.seoScore], ["GEO", score.geoScore]] as const).map(([label, v]) => (
          <div key={label} className={s.scoreRow}>
            <Progress value={v / 100} label={label} tone={scoreTone(v)} />
            <span className={[s.scoreNum, s[scoreTone(v)]].join(" ")}>{v}</span>
          </div>
        ))}
      </div>
      {score.summary && <p className="body-s secondary">{score.summary}</p>}
      <div className="caption mono">{score.model ? `${score.model} · ` : "rule engine · "}{when.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</div>
      {seo.length > 0 && <div><div className="micro" style={{ marginBottom: 8 }}>SEO (rule) · {seo.filter((c) => c.status === "pass").length}/{seo.length}</div><ul className={s.critList}>{seo.map((c) => <Criterion key={c.id} c={c} onFix={onFix} fixDisabled={fixDisabled} />)}</ul></div>}
      {geo.length > 0 && <div><div className="micro" style={{ marginBottom: 8 }}>GEO · {geo.filter((c) => c.status === "pass").length}/{geo.length}</div><ul className={s.critList}>{geo.map((c) => <Criterion key={c.id} c={c} onFix={onFix} fixDisabled={fixDisabled} />)}</ul></div>}
      {geo.length === 0 && <p className="caption">Chưa có tiêu chí GEO — bấm “Chấm lại (có AI)” để Claude đánh giá answer-first, citability, E-E-A-T.</p>}
    </Panel>
  );
}
