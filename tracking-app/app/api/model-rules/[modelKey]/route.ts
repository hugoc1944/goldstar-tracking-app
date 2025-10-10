import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_: Request, { params }: { params: { modelKey: string } }) {
  const rule = await prisma.modelRule.findUnique({
    where: { modelKey: params.modelKey },
  });

  return NextResponse.json({
    hideHandles: rule?.hideHandles ?? false,
    removeFinishes: rule?.removeFinishes ?? [],
    allowAcrylicAndPoly: rule?.allowAcrylicAndPoly ?? false,
    allowTowel1: rule?.allowTowel1 ?? false,
    hasFixingBar: rule?.hasFixingBar ?? false,
  });
}