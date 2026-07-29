import type { Prisma } from "@prisma/client";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const query = getQuery(event);
  const page = getPageQueryParam(query.page);
  const search = String(query.search ?? "").trim();
  const isActive = query.isActive === "true" ? true : query.isActive === "false" ? false : undefined;
  const limit = 20;

  const where: Prisma.ProductCollectionWhereInput = {
    ...(search
      ? {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } }
        ]
      }
      : {}),
    ...(isActive !== undefined ? { isActive } : {})
  };

  const [items, total] = await Promise.all([
    prisma.productCollection.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [
        { sortOrder: "asc" },
        { updatedAt: "desc" }
      ],
      select: {
        id: true,
        title: true,
        description: true,
        image: true,
        isActive: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            productCollectionItems: true
          }
        }
      }
    }),
    prisma.productCollection.count({ where })
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
