import { Badge, type BadgeTone } from "@/components/ui";

export const INTENT_LABEL: Record<string, { label: string; tone: BadgeTone }> = {
  informational: { label: "Informational", tone: "info" },
  commercial: { label: "Commercial", tone: "warning" },
  transactional: { label: "Transactional", tone: "success" },
  navigational: { label: "Navigational", tone: "neutral" },
  mixed: { label: "Mixed", tone: "outline" },
};

export function IntentBadge({ intent }: { intent: string | null | undefined }) {
  const m = (intent && INTENT_LABEL[intent]) || { label: intent ?? "—", tone: "outline" as BadgeTone };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
