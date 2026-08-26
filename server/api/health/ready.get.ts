import { Prisma } from "@prisma/client";
import { prisma } from "../../utils/prisma";

export default defineEventHandler(async () => {
  const startedAt = performance.now();

  try {
    await prisma.$queryRaw(Prisma.sql`SELECT 1`);

    return {
      status: "ready",
      checks: {
        database: "ok"
      },
      responseTimeMs: Math.round(performance.now() - startedAt),
      timestamp: new Date().toISOString()
    };
  } catch {
    throw createError({
      statusCode: 503,
      message: "Сервис временно не готов"
    });
  }
});
