import type { Prisma } from "@prisma/client";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const query = getQuery(event);
  const search = String(query.search ?? "").trim();
  const limit = getBoundedPositiveIntQueryParam(query.limit, 1000, 5000);

  const where: Prisma.ProductWhereInput = {
    isActive: true,
    ...(search
      ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { article: { contains: search, mode: "insensitive" } }
        ]
      }
      : {})
  };

  const items = await prisma.product.findMany({
    where,
    take: limit,
    orderBy: [
      { name: "asc" },
      { id: "asc" }
    ],
    select: {
      id: true,
      name: true,
      article: true,
      currentPrice: true,
      oldPrice: true,
      mainImage: true,
      isActive: true,
      productStocks: { select: { quantity: true } }
    }
  });

  return { items };
});
