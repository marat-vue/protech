import { AuditAction } from "@prisma/client";
import { promoCodeInputSchema } from "~~/shared/schemas/admin/promoCodes/upsertPromoCode";

export default defineEventHandler(async (event) => {
  const { userId } = await requireAdmin(event);
  const body = await validateBody(event, promoCodeInputSchema);

  try {
    const promoCode = await prisma.promoCode.create({
      data: {
        ...body,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null
      }
    });

    await recordAdminAudit({
      adminId: userId,
      action: AuditAction.CREATE,
      entityType: "promo_code",
      entityId: promoCode.id,
      summary: `Created promo code ${promoCode.code}`,
      metadata: { discountPercent: promoCode.discountPercent }
    });

    return { success: true, promoCode };
  } catch (error) {
    const prismaError = toPrismaHttpError(error, {
      P2002: "Промокод с таким кодом уже существует"
    });
    if (prismaError) throw prismaError;
    throw error;
  }
});
