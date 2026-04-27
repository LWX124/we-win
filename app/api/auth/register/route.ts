import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  const { name, email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ message: "邮箱和密码不能为空" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ message: "邮箱已被注册" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { name, email, passwordHash },
  });

  return NextResponse.json({ message: "注册成功" }, { status: 201 });
}
