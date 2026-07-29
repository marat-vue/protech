export default defineEventHandler(async () => {
  const collections = await prisma.productCollection.findMany({
    where: {
      isActive: true,
      productCollectionItems: {
        some: {
          product: {
            isActive: true
          }
        }
      }
    },
    orderBy: [
      { sortOrder: "asc" },
      { createdAt: "desc" }
    ],
    select: {
      id: true,
      title: true,
      description: true,
      image: true,
      productCollectionItems: {
        where: {
          product: {
            isActive: true
          }
        },
        select: {
          productId: true
        }
      }
    }
  });

  return collections.map((collection) => ({
    id: collection.id,
    title: collection.title,
    description: collection.description,
    image: collection.image,
    productsCount: collection.productCollectionItems.length
  }));
});
