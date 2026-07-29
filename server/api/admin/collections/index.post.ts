import { AuditAction } from "@prisma/client";
import { collectionInputSchema } from "~~/shared/schemas/admin/collections/upsertCollection";

export default defineEventHandler(async (event) => {
  const { userId } = await requireAdmin(event);
  const body = await validateBody(event, collectionInputSchema);

  await assertProductsExist(body.productIds);

  try {
    const collection = await prisma.productCollection.create({
      data: {
        title: body.title,
        description: body.description,
        image: body.image,
        isActive: body.isActive,
        sortOrder: body.sortOrder,
        productCollectionItems: {
          create: body.productIds.map((productId, index) => ({
            productId,
            sortOrder: index
          }))
        }
      },
      select: {
        id: true,
        title: true
      }
    });

    await recordAdminAudit({
      adminId: userId,
      action: AuditAction.CREATE,
      entityType: "product_collection",
      entityId: collection.id,
      summary: `Created product collection ${collection.title}`,
      metadata: {
        productIds: body.productIds
      }
    });

    return { success: true, collection };
  } catch (error) {
    const prismaError = toPrismaHttpError(error, {
      P2003: "Указан несуществующий товар"
    });

    if (prismaError) {
      throw prismaError;
    }

    throw createError({
      statusCode: 500,
      message: "Ошибка сервера при создании рубрики"
    });
  }
});

async function assertProductsExist(productIds: number[]) {
  const count = await prisma.product.count({
    where: {
      id: {
        in: productIds
      }
    }
  });

  if (count !== productIds.length) {
    throw createError({
      statusCode: 400,
      message: "Один или несколько товаров не найдены"
    });
  }
}
