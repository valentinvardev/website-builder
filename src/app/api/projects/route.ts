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

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { name, html, messages, files, id } = await req.json() as {
    name: string;
    html: string;
    messages?: string;
    files?: string;
    id?: string;
  };

  if (id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const project = await (db.project.update as any)({
      where: { id },
      data: { name, html, messages, files, updatedAt: new Date() },
    }) as Record<string, unknown>;
    return Response.json(project);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const project = await (db.project.create as any)({ data: { name, html, messages, files, userId } }) as Record<string, unknown>;
  return Response.json(project);
}

export async function DELETE(req: Request) {
  const { id } = await req.json() as { id: string };
  await db.project.delete({ where: { id } });
  return Response.json({ ok: true });
}
