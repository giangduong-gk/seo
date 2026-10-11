"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { memo, type CSSProperties } from "react";
import { Badge } from "@/components/ui";
import type { ClusterNode } from "@/lib/schemas";
import s from "./ClusterEditor.module.css";

/** `i`: thứ tự lúc vẽ lần đầu → độ trễ hiệu ứng xuất hiện (node thêm sau không có `i`). */
export type TopicNodeType = Node<{ node: ClusterNode; hasBrief: boolean; i?: number }, "topic">;

const KIND_LABEL: Record<ClusterNode["kind"], string> = { pillar: "Pillar", cluster: "Cluster", supporting: "Supporting" };
const INTENT_TONE = { informational: "info", commercial: "warning", transactional: "success", navigational: "neutral", mixed: "outline" } as const;

function TopicNodeView({ data, selected }: NodeProps<TopicNodeType>) {
  const n = data.node;
  const style = data.i != null ? ({ "--i": Math.min(data.i, 12) } as CSSProperties) : undefined;
  return (
    <div className={[s.node, s[n.kind] ?? "", selected ? s.nodeSelected : ""].join(" ")} style={style} title={n.summary ? `${n.title}\n\n${n.summary}` : n.title}>
      <Handle type="target" position={Position.Top} className={s.handle} />
      <div className={s.kind}><span>{KIND_LABEL[n.kind]}</span>{data.hasBrief && <span className={s.dot} title="Đã có brief" />}</div>
      <div className={s.title}>{n.title}</div>
      <div className={s.kw}>{n.targetKeyword}</div>
      <div className={s.meta}>
        <Badge tone={INTENT_TONE[n.intent]}>{n.intent}</Badge>
        <Badge tone={n.priority === "high" ? "new" : "outline"}>{n.priority}</Badge>
      </div>
      <Handle type="source" position={Position.Bottom} className={s.handle} />
    </div>
  );
}

export const TopicNode = memo(TopicNodeView);
