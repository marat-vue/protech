import { Prisma } from "@prisma/client";

type PromoCodeAvailability = {
  isActive: boolean;
  expiresAt: Date | null;
};

export function assertPromoCodeIsAvailable(
  promoCode: PromoCodeAvailability | null,
  now = new Date()
) {
  if (!promoCode) {
    throw createError({
      statusCode: 400,
      message: "Промокод не найден"
    });
  }

  if (!promoCode.isActive) {
    throw createError({
      statusCode: 400,
      message: "Промокод больше не действует"
    });
  }

  if (promoCode.expiresAt && promoCode.expiresAt.getTime() <= now.getTime()) {
    throw createError({
      statusCode: 400,
      message: "Срок действия промокода истёк"
    });
  }
}

export function calculatePromoPricing(
  subtotalValue: Prisma.Decimal.Value,
  discountPercent: number,
  totalQuantity: number
) {
  const subtotal = new Prisma.Decimal(subtotalValue).toDecimalPlaces(2);
  const minimumPayable = new Prisma.Decimal(Math.max(totalQuantity, 1)).div(100);
  const maximumDiscount = Prisma.Decimal.max(subtotal.sub(minimumPayable), 0);
  const requestedDiscount = subtotal
    .mul(discountPercent)
    .div(100)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const discountAmount = Prisma.Decimal.min(requestedDiscount, maximumDiscount);

  return {
    subtotal,
    discountAmount,
    totalAmount: subtotal.sub(discountAmount)
  };
}
