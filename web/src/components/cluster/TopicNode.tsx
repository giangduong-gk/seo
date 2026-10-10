"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui";
import type { ClusterNode } from "@/lib/schemas";
import s from "./ClusterEditor.module.css";

export type TopicNodeType = Node<{ node: ClusterNode; hasBrief: boolean }, "topic">;

const KIND_LABEL: Record<ClusterNode["kind"], string> = { pillar: "Pillar", cluster: "Cluster", supporting: "Supporting" };
const INTENT_TONE = { informational: "info", commercial: "warning", transactional: "success", navigational: "neutral", mixed: "outline" } as const;

export function TopicNode({ data, selected }: NodeProps<TopicNodeType>) {
  const n = data.node;
  return (
    <div className={[s.node, s[n.kind] ?? "", selected ? s.nodeSelected : ""].join(" ")} title={n.summary}>
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
