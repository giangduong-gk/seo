"use client";

import { useParams, usePathname } from "next/navigation";
import { Skeleton } from "@/components/ui/Skeleton";
import { SubNav } from "./SubNav";
import { projectTabItems, tabFromPath } from "./projectTabs";

/** Dải tab thật trong lúc tải (bấm được ngay); số đếm thay bằng placeholder cùng cỡ. */
export function ProjectTabsSkeleton() {
  const params = useParams<{ id?: string }>();
  const pathname = usePathname() ?? "";
  const id = typeof params?.id === "string" ? params.id : "";
  if (!id) return null;
  return <SubNav items={projectTabItems(id, tabFromPath(pathname))} renderCount={() => <Skeleton width={20} height={16} radius={5} />} />;
}
