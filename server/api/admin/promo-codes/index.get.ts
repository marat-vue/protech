import type { Prisma } from "@prisma/client";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const query = getQuery(event);
  const page = getPageQueryParam(query.page);
  const search = String(query.search ?? "").trim();
  const status = String(query.status ?? "all");
  const limit = 20;
  const now = new Date();

  if (!["all", "active", "inactive", "expired"].includes(status)) {
    throw createError({ statusCode: 400, message: "Некорректный статус промокода" });
  }

  const where: Prisma.PromoCodeWhereInput = {
    ...(search ? { code: { contains: search, mode: "insensitive" } } : {}),
    ...(status === "active"
      ? {
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
        }
      : status === "inactive"
        ? { isActive: false }
        : status === "expired"
          ? { isActive: true, expiresAt: { lte: now } }
          : {})
  };
  const [items, total] = await Promise.all([
    prisma.promoCode.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        discountPercent: true,
        isActive: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { orders: true } }
      }
    }),
    prisma.promoCode.count({ where })
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
});
