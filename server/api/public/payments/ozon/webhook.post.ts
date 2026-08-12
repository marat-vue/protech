import { z } from "zod";
import {
  getOzonPayNotificationCredentials,
  verifyOzonPayNotificationSignature
} from "~~/server/utils/ozonPay";
import { applyOzonPayOrderStatus } from "~~/server/utils/ozonPayPaymentStatus";

const ozonPayWebhookSchema = z
  .object({
    orderID: z.string().min(1),
    extOrderID: z.string().optional().nullable(),
    transactionID: z.union([z.number().int(), z.string()]).optional().nullable(),
    transactionUID: z.string().optional(),
    transactionUid: z.string().optional(),
    amount: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]),
    currencyCode: z.string().min(1),
    status: z.enum(["Rejected", "Completed", "Authorized"]),
    operationType: z.literal("Payment"),
    requestSign: z.string().min(1)
  })
  .passthrough();

export default defineEventHandler(async (event) => {
  const body = await validateBody(event, ozonPayWebhookSchema);
  const credentials = getOzonPayNotificationCredentials(event);
  const signatureIsValid = verifyOzonPayNotificationSignature(
    credentials.accessKey,
    credentials.notificationSecretKey,
    {
      orderID: body.orderID,
      transactionID: body.transactionID,
      extOrderID: body.extOrderID,
      amount: body.amount,
      currencyCode: body.currencyCode
    },
    body.requestSign
  );

  if (!signatureIsValid) {
    throw createError({
      statusCode: 401,
      message: "Некорректная подпись уведомления Ozon Pay"
    });
  }

  if (body.status === "Rejected") {
    return {
      ok: true,
      status: body.status
    };
  }

  return applyOzonPayOrderStatus({
    id: body.orderID,
    extId: body.extOrderID,
    status: body.status === "Completed" ? "STATUS_PAID" : "STATUS_AUTHORIZED",
    originalAmount: {
      currencyCode: body.currencyCode,
      value: String(body.amount)
    }
  });
});
