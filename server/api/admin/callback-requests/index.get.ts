import { CallbackRequestStatus, type Prisma } from "@prisma/client";

const callbackRequestStatuses = new Set<string>(Object.values(CallbackRequestStatus));

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const query = getQuery(event);
  const page = getPageQueryParam(query.page);
  const search = String(query.search ?? "").trim();
  const status = query.status ? String(query.status) : undefined;
  const limit = 20;

  if (status && !callbackRequestStatuses.has(status)) {
    throw createError({
      statusCode: 400,
      message: "Некорректный статус заявки"
    });
  }

  const where: Prisma.CallbackRequestWhereInput = {
    ...(search
      ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } }
        ]
      }
      : {}),
    ...(status ? { status: status as CallbackRequestStatus } : {})
  };

  const [items, total] = await Promise.all([
    prisma.callbackRequest.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [
        { status: "asc" },
        { createdAt: "desc" }
      ]
    }),
    prisma.callbackRequest.count({ where })
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
