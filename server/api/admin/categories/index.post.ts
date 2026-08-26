import { AuditAction } from "@prisma/client";
import { categorySchema } from "~~/shared/schemas/admin/products/category";

export default defineEventHandler(async (event) => {
  const { userId } = await requireAdmin(event);

  const body = await validateBody(event, categorySchema);

  try {
    const category = await prisma.$transaction(async (tx) => {
      const lastCategory = await tx.category.findFirst({
        orderBy: [
          { sortOrder: "desc" },
          { id: "desc" }
        ],
        select: {
          sortOrder: true
        }
      });

      return await tx.category.create({
        data: {
          name: body.name,
          sortOrder: (lastCategory?.sortOrder ?? -1) + 1
        }
      });
    });

    await recordAdminAudit({
      adminId: userId,
      action: AuditAction.CREATE,
      entityType: "category",
      entityId: category.id,
      summary: `Created category ${category.name}`
    });

    return { success: true, category };
  } catch (error) {
    const prismaError = toPrismaHttpError(error, {
      P2002: "Категория с таким названием уже существует"
    });

    if (prismaError) {
      throw prismaError;
    }

    throw createError({
      statusCode: 500,
      message: "Ошибка сервера при создании категории"
    });
  }
});
