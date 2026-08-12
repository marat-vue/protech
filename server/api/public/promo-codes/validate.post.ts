import { Prisma } from "@prisma/client";
import { assertPromoCodeIsAvailable, calculatePromoPricing } from "~~/server/utils/promoCode";
import { validatePromoCodeSchema } from "~~/shared/schemas/user/promoCodes/validatePromoCode";

export default defineEventHandler(async (event) => {
  await requireUser(event);
  const body = await validateBody(event, validatePromoCodeSchema);
  const productIds = body.orderItems.map((item) => item.productId);

  const [promoCode, products] = await Promise.all([
    prisma.promoCode.findUnique({
      where: { code: body.code },
      select: {
        code: true,
        discountPercent: true,
        isActive: true,
        expiresAt: true
      }
    }),
    prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: { id: true, currentPrice: true }
    })
  ]);

  assertPromoCodeIsAvailable(promoCode);

  if (products.length !== productIds.length) {
    throw createError({
      statusCode: 400,
      message: "Состав корзины изменился. Обновите страницу"
    });
  }

  const priceByProductId = new Map(
    products.map((product) => [product.id, new Prisma.Decimal(product.currentPrice)])
  );
  const subtotal = body.orderItems.reduce(
    (sum, item) => sum.add(priceByProductId.get(item.productId)!.mul(item.quantity)),
    new Prisma.Decimal(0)
  );
  const pricing = calculatePromoPricing(
    subtotal,
    promoCode!.discountPercent,
    body.orderItems.reduce((sum, item) => sum + item.quantity, 0)
  );

  return {
    code: promoCode!.code,
    discountPercent: promoCode!.discountPercent,
    subtotal: pricing.subtotal,
    discountAmount: pricing.discountAmount,
    totalAmount: pricing.totalAmount
  };
});
