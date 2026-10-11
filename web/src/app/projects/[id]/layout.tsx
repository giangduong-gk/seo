import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { prisma } from "@/lib/db";

/**
 * Chặn 404 trước khi stream. Layout nằm NGOÀI loading.tsx của các segment con, nên `notFound()` ở đây
 * trả đúng HTTP 404 (nếu để ở page bên trong một loading boundary, Next đã stream skeleton với HTTP 200).
 */
export default async function ProjectLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const exists = await prisma.project.findUnique({ where: { id }, select: { id: true } });
  if (!exists) notFound();
  return children;
}
