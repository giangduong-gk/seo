import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { prisma } from "@/lib/db";

/** Trả HTTP 404 thật trước khi loading.tsx của trang này stream (xem projects/[id]/layout.tsx). */
export default async function Guard({ children, params }: { children: ReactNode; params: Promise<{ id: string; clusterId: string }> }) {
  const { id, clusterId } = await params;
  const row = await prisma.cluster.findUnique({ where: { id: clusterId }, select: { projectId: true } });
  if (!row || row.projectId !== id) notFound();
  return children;
}
