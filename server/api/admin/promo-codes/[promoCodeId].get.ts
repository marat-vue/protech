export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const promoCodeId = getPositiveIntRouterParam(event, "promoCodeId", "Некорректный ID промокода");
  const promoCode = await prisma.promoCode.findUnique({
    where: { id: promoCodeId },
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
  });

  if (!promoCode) {
    throw createError({ statusCode: 404, message: "Промокод не найден" });
  }

  return promoCode;
});
