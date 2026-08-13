import { z } from "zod";
import {
  encodeOzonPayOrderId,
  getOzonPayNotificationCredentials,
  verifyOzonPayNotificationSignature
} from "~~/server/utils/ozonPay";
import { syncOzonPayOrderStatus } from "~~/server/utils/ozonPayPaymentStatus";

const ozonPayWebhookSchema = z
  .object({
    orderID: z.string().min(1),
    extOrderID: z.string().optional().nullable(),
    transactionID: z.union([z.number().int(), z.string()]).optional().nullable(),
    transactionUID: z.string().optional(),
    transactionUid: z.string().optional(),
    amount: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]),
    currencyCode: z.string().min(1),
    status: z.string().min(1).max(64),
    operationType: z.string().min(1).max(64),
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

  return syncOzonPayOrderStatus(event, encodeOzonPayOrderId(body.orderID));
});
