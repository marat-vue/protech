import { AuditAction } from "@prisma/client";
import { categoryOrderSchema } from "~~/shared/schemas/admin/products/category";

export default defineEventHandler(async (event) => {
  const { userId } = await requireAdmin(event);
  const body = await validateBody(event, categoryOrderSchema);

  const categories = await prisma.category.findMany({
    select: {
      id: true
    }
  });

  const existingIds = new Set(categories.map((category) => category.id));
  const containsEveryCategory = body.categoryIds.length === existingIds.size
    && body.categoryIds.every((categoryId) => existingIds.has(categoryId));

  if (!containsEveryCategory) {
    throw createError({
      statusCode: 409,
      message: "Список категорий изменился. Обновите страницу и повторите попытку"
    });
  }

  try {
    await prisma.$transaction(
      body.categoryIds.map((categoryId, sortOrder) => prisma.category.update({
        where: { id: categoryId },
        data: { sortOrder }
      }))
    );

    await recordAdminAudit({
      adminId: userId,
      action: AuditAction.UPDATE,
      entityType: "category_order",
      summary: "Updated category display order",
      metadata: {
        categoryIds: body.categoryIds
      }
    });

    return { success: true };
  } catch (error) {
    const prismaError = toPrismaHttpError(error, {
      P2025: "Одна или несколько категорий не найдены"
    });

    if (prismaError) {
      throw prismaError;
    }

    throw createError({
      statusCode: 500,
      message: "Ошибка сервера при изменении порядка категорий"
    });
  }
});
