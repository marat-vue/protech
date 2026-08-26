import { AuditAction, type Prisma } from "@prisma/client";
import { updateCollectionInputSchema } from "~~/shared/schemas/admin/collections/upsertCollection";
import { deleteStoredImages, getRemovedImageUrls } from "../../../../utils/uploadImage";

export default defineEventHandler(async (event) => {
  const { userId } = await requireAdmin(event);
  const collectionId = getPositiveIntRouterParam(event, "collectionId", "Некорректный ID рубрики");
  const body = await validateBody(event, updateCollectionInputSchema);

  if (body.productIds !== undefined) {
    await assertProductsExist(body.productIds);
  }

  const existing = body.image !== undefined
    ? await prisma.productCollection.findUnique({
      where: { id: collectionId },
      select: {
        image: true
      }
    })
    : null;

  const data: Prisma.ProductCollectionUpdateInput = {};

  if (body.title !== undefined) data.title = body.title;
  if (body.description !== undefined) data.description = body.description;
  if (body.image !== undefined) data.image = body.image;
  if (body.isActive !== undefined) data.isActive = body.isActive;
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;

  if (body.productIds !== undefined) {
    data.productCollectionItems = {
      deleteMany: {},
      create: body.productIds.map((productId, index) => ({
        productId,
        sortOrder: index
      }))
    };
  }

  try {
    const collection = await prisma.productCollection.update({
      where: { id: collectionId },
      data,
      select: {
        id: true,
        title: true
      }
    });

    if (existing && body.image !== undefined) {
      await deleteStoredImages(getRemovedImageUrls([existing.image], [body.image]));
    }

    await recordAdminAudit({
      adminId: userId,
      action: AuditAction.UPDATE,
      entityType: "product_collection",
      entityId: collection.id,
      summary: `Updated product collection ${collection.title}`,
      metadata: {
        fields: Object.keys(body),
        productIds: body.productIds
      }
    });

    return { success: true, collection };
  } catch (error) {
    const prismaError = toPrismaHttpError(error, {
      P2025: "Рубрика не найдена",
      P2003: "Указан несуществующий товар"
    });

    if (prismaError) {
      throw prismaError;
    }

    throw createError({
      statusCode: 500,
      message: "Ошибка сервера при обновлении рубрики"
    });
  }
});

async function assertProductsExist(productIds: number[]) {
  if (productIds.length === 0) {
    return;
  }

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
