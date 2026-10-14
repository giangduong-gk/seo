import { notFound } from "next/navigation";
import { SystemNotice } from "@/components/ui";
import { ClusterEditor } from "@/components/cluster/ClusterEditor";
import { hasApiKey } from "@/lib/claude";
import { prisma } from "@/lib/db";
import { ClusterMap, type StoredClusterMap } from "@/lib/schemas";
import { ProjectHeader } from "../../ProjectHeader";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function ClusterPage({ params }: { params: Promise<{ id: string; clusterId: string }> }) {
  const { id, clusterId } = await params;
  const c = await prisma.cluster.findUnique({ where: { id: clusterId }, include: { briefs: { select: { id: true, targetKeyword: true } } } });
  if (!c || c.projectId !== id) notFound();
  const raw = JSON.parse(c.data) as StoredClusterMap;
  const parsed = ClusterMap.safeParse(raw);
  if (!parsed.success) {
    return <div className="container stack page-in"><SystemNotice tone="red" title="Dữ liệu cluster không đúng schema">{parsed.error.issues[0]?.message}</SystemNotice></div>;
  }
  const map: StoredClusterMap = { ...parsed.data, positions: raw.positions, layout: raw.layout };

  return (
    <div className="container stack page-in">
      <ProjectHeader projectId={id} active="clusters" trail={c.title} />
      <ClusterEditor
        projectId={id}
        clusterId={clusterId}
        initial={map}
        model={c.model}
        canGenerate={hasApiKey()}
        briefsByKeyword={Object.fromEntries(c.briefs.map((b) => [b.targetKeyword.toLowerCase(), b.id]))}
      />
    </div>
  );
}
