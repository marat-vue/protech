export default defineEventHandler(async (event) => {
  try {
    const categories = await prisma.category.findMany({
      select: {
        id: true,
        name: true
      },
      orderBy: [
        { sortOrder: "asc" },
        { id: "asc" }
      ]
    });

    return categories;
  } catch {
    throw createError({
      statusCode: 500,
      message: "Ошибка сервера при получении категорий"
    })
  }
});
