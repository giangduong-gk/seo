import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { prisma } from "@/lib/db";

/** Trả HTTP 404 thật trước khi loading.tsx của trang này stream (xem projects/[id]/layout.tsx). */
export default async function Guard({ children, params }: { children: ReactNode; params: Promise<{ id: string; briefId: string }> }) {
  const { id, briefId } = await params;
  const row = await prisma.brief.findUnique({ where: { id: briefId }, select: { projectId: true } });
  if (!row || row.projectId !== id) notFound();
  return children;
}
