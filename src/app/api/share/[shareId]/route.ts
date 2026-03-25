import { db } from "~/server/db";

export async function GET(_req: Request, { params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  const project = await db.project.findUnique({ where: { shareId } });

  if (!project) {
    return new Response("<h1>Project not found</h1>", {
      status: 404,
      headers: { "Content-Type": "text/html" },
    });
  }

  return new Response(project.html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
