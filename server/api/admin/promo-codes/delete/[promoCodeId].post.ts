import { AuditAction } from "@prisma/client";

export default defineEventHandler(async (event) => {
  const { userId } = await requireAdmin(event);
  const promoCodeId = getPositiveIntRouterParam(event, "promoCodeId", "Некорректный ID промокода");

  try {
    const promoCode = await prisma.promoCode.delete({
      where: { id: promoCodeId },
      select: { id: true, code: true }
    });

    await recordAdminAudit({
      adminId: userId,
      action: AuditAction.DELETE,
      entityType: "promo_code",
      entityId: promoCode.id,
      summary: `Deleted promo code ${promoCode.code}`
    });

    return { success: true };
  } catch (error) {
    const prismaError = toPrismaHttpError(error, { P2025: "Промокод не найден" });
    if (prismaError) throw prismaError;
    throw error;
  }
});
