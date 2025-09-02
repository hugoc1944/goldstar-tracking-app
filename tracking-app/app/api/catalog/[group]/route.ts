// app/api/catalog/[group]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: { group: string } };

export async function GET(_req: Request, { params }: Params) {
  const group = params.group.toUpperCase(); // PROFILE|ACRYLIC|SERIGRAPHY|MONOCHROME
  const rows = await prisma.catalogOption.findMany({
    where: { group, active: true },
    orderBy: [{ category: 'asc' }, { sort: 'asc' }],
    select: { value: true, label: true, category: true },
  });
  return NextResponse.json(rows);
}
