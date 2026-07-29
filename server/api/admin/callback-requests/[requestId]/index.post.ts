import { AuditAction, CallbackRequestStatus } from "@prisma/client";
import { updateCallbackRequestSchema } from "~~/shared/schemas/admin/callbackRequests/updateCallbackRequest";

const terminalStatuses = new Set<CallbackRequestStatus>([
  CallbackRequestStatus.COMPLETED,
  CallbackRequestStatus.CANCELLED
]);

export default defineEventHandler(async (event) => {
  const { userId } = await requireAdmin(event);
  const requestId = getPositiveIntRouterParam(event, "requestId", "Некорректный ID заявки");
  const body = await validateBody(event, updateCallbackRequestSchema);

  const existing = await prisma.callbackRequest.findUnique({
    where: { id: requestId },
    select: { id: true }
  });

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: "Заявка на звонок не найдена"
    });
  }

  const callbackRequest = await prisma.callbackRequest.update({
    where: { id: requestId },
    data: {
      status: body.status,
      adminNote: body.adminNote || null,
      processedAt: terminalStatuses.has(body.status) ? new Date() : null
    }
  });

  await recordAdminAudit({
    adminId: userId,
    action: AuditAction.UPDATE,
    entityType: "callback_request",
    entityId: requestId,
    summary: "Updated callback request",
    metadata: {
      status: body.status
    }
  });

  return {
    success: true,
    callbackRequest
  };
});
