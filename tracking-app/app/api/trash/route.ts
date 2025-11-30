// app/api/trash/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth-helpers";

export const runtime = "nodejs";

// ---------- GET: list all soft-deleted things ----------
export async function GET(req: Request) {
  await requireAdminSession();
  const url = new URL(req.url);

  const rawSearch = url.searchParams.get("search")?.trim() ?? "";
  const search = rawSearch.startsWith("#") ? rawSearch.slice(1) : rawSearch;

  const textFilter = search
    ? {
        contains: search,
        mode: "insensitive" as const,
      }
    : undefined;

  // 1) Deleted customers
  const customerWhere: any = {
    deletedAt: { not: null },
  };

  if (textFilter) {
    customerWhere.OR = [
      { name: textFilter },
      { email: textFilter },
      { phone: textFilter },
    ];
  }

  const customers = await prisma.customer.findMany({
    where: customerWhere,
    orderBy: { deletedAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      deletedAt: true,
      createdAt: true,
      _count: { select: { orders: true } },
    },
  });

  // 2) Deleted orders
  const orderWhere: any = {
    deletedAt: { not: null },
  };

  if (textFilter) {
    orderWhere.OR = [
      { id: textFilter },
      { publicToken: textFilter },
      {
        customer: {
          is: {
            name: textFilter,
          },
        },
      },
    ];
  }

  const orders = await prisma.order.findMany({
    where: orderWhere,
    orderBy: { deletedAt: "desc" },
    include: {
      customer: { select: { name: true } },
    },
  });

  // 3) Deleted budgets
  const budgetWhere: any = {
    deletedAt: { not: null },
  };

  if (textFilter) {
    budgetWhere.OR = [
      { id: textFilter },
      { email: textFilter },
      { name: textFilter },
    ];
  }

  const budgets = await prisma.budget.findMany({
    where: budgetWhere,
    orderBy: { deletedAt: "desc" },
  });

  // Normalize to unified rows
  const rows = [
    ...customers.map((c) => ({
      type: "customer" as const,
      id: c.id,
      name: c.name,
      email: c.email,
      extra: `${c._count.orders} pedidos`,
      deletedAt: c.deletedAt ? c.deletedAt.toISOString() : null,
      createdAt: c.createdAt ? c.createdAt.toISOString() : null,
      source: "Clientes",
    })),
   ...orders.map((o) => {
    const source =
        o.status === "ENTREGUE"
        ? "Arquivos"      // came from Archives
        : "Pedidos";       // came from active Orders

    return {
        type: "order" as const,
        id: o.id,
        name: o.customer?.name ?? "",
        email: "",
        extra: `Estado: ${o.status}`,
        deletedAt: o.deletedAt ? o.deletedAt.toISOString() : null,
        createdAt: o.createdAt ? o.createdAt.toISOString() : null,
        source,
    };
    }),
    ...budgets.map((b) => ({
      type: "budget" as const,
      id: b.id,
      name: b.name,
      email: b.email,
      extra: `Modelo: ${b.modelKey}`,
      deletedAt: b.deletedAt ? b.deletedAt.toISOString() : null,
      createdAt: b.createdAt ? b.createdAt.toISOString() : null,
      source: "Orçamentos",
    })),
  ];

  rows.sort((a, b) => {
    const ad = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
    const bd = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
    return bd - ad; // most recently deleted first
  });

  return NextResponse.json({ rows });
}

// ---------- POST: restore / hard-delete ----------
type TrashItem = {
  type: "order" | "customer" | "budget";
  id: string;
};

type TrashActionBody = {
  action: "restore" | "hard-delete";
  items: TrashItem[];
};

export async function POST(req: Request) {
  const admin = await requireAdminSession();
  void admin; // in case TS complains it's unused

  let body: TrashActionBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    !body ||
    (body.action !== "restore" && body.action !== "hard-delete") ||
    !Array.isArray(body.items) ||
    body.items.length === 0
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    for (const item of body.items) {
      const { type, id } = item;

      if (!id || !type) continue;

      if (body.action === "restore") {
        switch (type) {
          case "order":
            await tx.order.update({
              where: { id },
              data: { deletedAt: null },
            });
            break;
          case "customer":
            await tx.customer.update({
              where: { id },
              data: { deletedAt: null },
            });
            break;
          case "budget":
            await tx.budget.update({
              where: { id },
              data: { deletedAt: null },
            });
            break;
        }
      } else if (body.action === "hard-delete") {
        switch (type) {
          case "order":
            // remove related children first to avoid FK issues
            await tx.statusEvent.deleteMany({ where: { orderId: id } });
            await tx.message.deleteMany({ where: { orderId: id } });
            await tx.orderItem.deleteMany({ where: { orderId: id } });
            await tx.order.delete({ where: { id } });
            break;
          case "customer":
            // NOTE: will fail if there are non-deleted orders referencing this customer
            await tx.customer.delete({ where: { id } });
            break;
          case "budget":
            await tx.budget.delete({ where: { id } });
            break;
        }
      }
    }
  });

  return NextResponse.json({ ok: true });
}

