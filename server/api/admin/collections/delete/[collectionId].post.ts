import { AuditAction } from "@prisma/client";
import { deleteStoredImages } from "../../../../utils/uploadImage";

export default defineEventHandler(async (event) => {
  const { userId } = await requireAdmin(event);
  const collectionId = getPositiveIntRouterParam(event, "collectionId", "Некорректный ID рубрики");

  try {
    const collection = await prisma.productCollection.delete({
      where: { id: collectionId },
      select: {
        id: true,
        title: true,
        image: true
      }
    });

    await deleteStoredImages([collection.image]);

    await recordAdminAudit({
      adminId: userId,
      action: AuditAction.DELETE,
      entityType: "product_collection",
      entityId: collection.id,
      summary: `Deleted product collection ${collection.title}`
    });

    return { success: true };
  } catch (error) {
    const prismaError = toPrismaHttpError(error, {
      P2025: "Рубрика не найдена"
    });

    if (prismaError) {
      throw prismaError;
    }

    throw createError({
      statusCode: 500,
      message: "Ошибка сервера при удалении рубрики"
    });
  }
});
