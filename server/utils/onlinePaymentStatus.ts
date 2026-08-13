import type { H3Event } from "h3";
import { decodeOzonPayOrderId } from "./ozonPay";
import { syncOzonPayOrderStatus } from "./ozonPayPaymentStatus";
import { syncYooKassaPaymentStatus } from "./yookassaPaymentStatus";

export function syncOnlinePaymentStatus(event: H3Event | undefined, transactionId: string) {
  return decodeOzonPayOrderId(transactionId)
    ? syncOzonPayOrderStatus(event, transactionId)
    : syncYooKassaPaymentStatus(event, transactionId);
}
