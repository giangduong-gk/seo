import { NextResponse } from "next/server";
import { briefToMarkdown } from "@/lib/brief";
import { prisma } from "@/lib/db";
import { ContentBrief } from "@/lib/schemas";

export async function GET(req: Request, { params }: { params: Promise<{ briefId: string }> }) {
  const { briefId } = await params;
  const b = await prisma.brief.findUnique({ where: { id: briefId }, include: { project: { select: { name: true } } } });
  if (!b) return NextResponse.json({ error: "Không tìm thấy brief" }, { status: 404 });
  const parsed = ContentBrief.safeParse(JSON.parse(b.data));
  if (!parsed.success) return NextResponse.json({ error: "Brief không đúng schema" }, { status: 500 });
  const md = briefToMarkdown(parsed.data, { project: b.project.name, createdAt: b.createdAt });
  const download = new URL(req.url).searchParams.get("download");
  const headers: Record<string, string> = { "Content-Type": "text/markdown; charset=utf-8" };
  if (download) headers["Content-Disposition"] = `attachment; filename="brief-${parsed.data.slug || b.id}.md"`;
  return new NextResponse(md, { headers });
}
