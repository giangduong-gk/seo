import type { SubNavItem } from "./SubNav";

export type ProjectTab = "analyses" | "clusters" | "briefs" | "articles";

/** Danh sách tab của một dự án — dùng chung cho ProjectHeader (server) và skeleton (client). */
export const PROJECT_TABS: { key: ProjectTab; label: string; path: string }[] = [
  { key: "analyses", label: "Phân tích từ khoá", path: "" },
  { key: "clusters", label: "Topic Cluster", path: "/clusters" },
  { key: "briefs", label: "Content Brief", path: "/briefs" },
  { key: "articles", label: "Bài viết", path: "/articles" },
];

export function projectTabItems(projectId: string, active: ProjectTab | null, counts?: Partial<Record<ProjectTab, number>>): SubNavItem[] {
  const base = `/projects/${projectId}`;
  return PROJECT_TABS.map((t) => ({ href: base + t.path, label: t.label, count: counts?.[t.key], active: t.key === active }));
}

/** Suy ra tab đang mở từ pathname: /projects/:id[/analyses/...] → analyses, /projects/:id/clusters/... → clusters… */
export function tabFromPath(pathname: string): ProjectTab | null {
  const m = pathname.match(/^\/projects\/[^/]+(?:\/([^/]+))?/);
  if (!m) return null;
  const seg = m[1];
  if (!seg || seg === "analyses") return "analyses";
  return (["clusters", "briefs", "articles"] as const).find((k) => k === seg) ?? null;
}
