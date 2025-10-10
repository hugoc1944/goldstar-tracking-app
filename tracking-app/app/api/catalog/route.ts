// app/api/catalog/route.ts
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, bad } from '@/lib/http';

export async function GET(req: NextRequest) {
  try {
    const rows = await prisma.catalogOption.findMany({
      where: { active: true },
      orderBy: [{ group: 'asc' }, { order: 'asc' }, { label: 'asc' }],
      select: { group: true, value: true, label: true, category: true, order: true },
    });

    const grouped: Record<string, any[]> = {};
    for (const r of rows) {
      if (!grouped[r.group]) grouped[r.group] = [];
      grouped[r.group].push({
        value: r.value,
        label: r.label,
        ...(r.category ? { category: r.category } : {}),
        order: r.order ?? 0,
      });
    }

    // Optionally, add friendly aliases for the UI:
    grouped['FINISH'] = [
      ...(grouped['FINISH_METALICO'] ?? []),
      ...(grouped['FINISH_LACADO'] ?? []),
    ];

    return ok(grouped);
  } catch (e: any) {
    return bad(e?.message ?? 'Erro a carregar catálogo', 500);
  }
}
