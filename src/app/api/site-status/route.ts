import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const setting = await prisma.siteSetting.findUnique({
    where: { id: 1 },
    select: { isClosed: true },
  });

  return NextResponse.json({
    isClosed: setting?.isClosed ?? false,
  });
}
