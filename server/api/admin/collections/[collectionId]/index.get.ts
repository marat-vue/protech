export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const collectionId = getPositiveIntRouterParam(event, "collectionId", "Некорректный ID рубрики");

  const collection = await prisma.productCollection.findUnique({
    where: { id: collectionId },
    select: {
      id: true,
      title: true,
      description: true,
      image: true,
      isActive: true,
      sortOrder: true,
      productCollectionItems: {
        orderBy: [
          { sortOrder: "asc" },
          { id: "asc" }
        ],
        select: {
          product: {
            select: {
              id: true,
              name: true,
              article: true,
              currentPrice: true,
              oldPrice: true,
              mainImage: true,
              isActive: true,
              productStocks: {
                select: {
                  quantity: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!collection) {
    throw createError({
      statusCode: 404,
      message: "Рубрика не найдена"
    });
  }

  return {
    id: collection.id,
    title: collection.title,
    description: collection.description,
    image: collection.image,
    isActive: collection.isActive,
    sortOrder: collection.sortOrder,
    products: collection.productCollectionItems.map((item) => item.product)
  };
});
