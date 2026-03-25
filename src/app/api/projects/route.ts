import { auth } from "~/server/auth";
import { db } from "~/server/db";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  const projects = await db.project.findMany({
    where: userId ? { userId } : { userId: null },
    select: { id: true, name: true, shareId: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  return Response.json(projects);
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const { name, html, id } = await req.json() as { name: string; html: string; id?: string };

  if (id) {
    const project = await db.project.update({
      where: { id },
      data: { name, html, updatedAt: new Date() },
    });
    return Response.json(project);
  }

  const project = await db.project.create({ data: { name, html, userId } });
  return Response.json(project);
}

export async function DELETE(req: Request) {
  const { id } = await req.json() as { id: string };
  await db.project.delete({ where: { id } });
  return Response.json({ ok: true });
}
