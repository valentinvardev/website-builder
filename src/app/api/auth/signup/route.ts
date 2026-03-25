import bcrypt from "bcryptjs";
import { db } from "~/server/db";

export async function POST(req: Request) {
  const { name, email, password } = await req.json() as {
    name: string;
    email: string;
    password: string;
  };

  if (!name || !email || !password) {
    return Response.json({ error: "All fields are required" }, { status: 400 });
  }

  if (password.length < 8) {
    return Response.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return Response.json({ error: "Email already in use" }, { status: 400 });
  }

  const hashed = await bcrypt.hash(password, 12);

  await db.user.create({
    data: { name, email, password: hashed },
  });

  return Response.json({ ok: true });
}
