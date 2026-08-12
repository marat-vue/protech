import { AuditAction, type Prisma } from "@prisma/client";
import { updatePromoCodeInputSchema } from "~~/shared/schemas/admin/promoCodes/upsertPromoCode";

export default defineEventHandler(async (event) => {
  const { userId } = await requireAdmin(event);
  const promoCodeId = getPositiveIntRouterParam(event, "promoCodeId", "Некорректный ID промокода");
  const body = await validateBody(event, updatePromoCodeInputSchema);
  const data: Prisma.PromoCodeUpdateInput = {
    ...body,
    ...(body.expiresAt !== undefined
      ? { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null }
      : {})
  };

  try {
    const promoCode = await prisma.promoCode.update({
      where: { id: promoCodeId },
      data
    });

    await recordAdminAudit({
      adminId: userId,
      action: AuditAction.UPDATE,
      entityType: "promo_code",
      entityId: promoCode.id,
      summary: `Updated promo code ${promoCode.code}`,
      metadata: { fields: Object.keys(body) }
    });

    return { success: true, promoCode };
  } catch (error) {
    const prismaError = toPrismaHttpError(error, {
      P2002: "Промокод с таким кодом уже существует",
      P2025: "Промокод не найден"
    });
    if (prismaError) throw prismaError;
    throw error;
  }
});
