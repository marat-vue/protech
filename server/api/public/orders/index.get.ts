import { PaymentStatus } from "@prisma/client";
import type { H3Event } from "h3";
import { attachOrdersPaymentMeta } from "~~/server/utils/orderPaymentMeta";
import { attachOrderStatusHistory, getOrderStatusHistoryAuditLogs } from "~~/server/utils/orderStatusHistory";
import { syncOnlinePaymentStatus } from "~~/server/utils/onlinePaymentStatus";
import { publicOrderSelect, toPublicOrderDto, type PublicOrderRecord } from "~~/server/utils/publicOrderDto";

async function syncPendingOnlineOrders(event: H3Event, orders: PublicOrderRecord[]) {
  const pendingPaymentIds = orders
    .filter((order) => (
      order.paymentMethod === "ONLINE" &&
      order.payment?.paymentStatus === PaymentStatus.PENDING &&
      order.payment.transactionId
    ))
    .map((order) => order.payment!.transactionId!);

  if (!pendingPaymentIds.length) {
    return false;
  }

  const syncResults = await Promise.allSettled(
    pendingPaymentIds.map((paymentId) => syncOnlinePaymentStatus(event, paymentId))
  );

  for (const result of syncResults) {
    if (result.status === "rejected") {
      console.error("Failed to sync online payment status", result.reason);
    }
  }

  return syncResults.some((result) => (
    result.status === "fulfilled" &&
    (result.value.processed || result.value.alreadyProcessed)
  ));
}

export default defineEventHandler(async (event) => {
  const { userId } = await requireUser(event);

  let orders = await prisma.order.findMany({
    where: {
      userId
    },
    select: publicOrderSelect,
    orderBy: {
      createdAt: "desc"
    }
  });

  if (await syncPendingOnlineOrders(event, orders)) {
    orders = await prisma.order.findMany({
      where: {
        userId
      },
      select: publicOrderSelect,
      orderBy: {
        createdAt: "desc"
      }
    });
  }

  const statusAuditLogs = await getOrderStatusHistoryAuditLogs(orders);

  return attachOrdersPaymentMeta(attachOrderStatusHistory(orders, statusAuditLogs)).map(toPublicOrderDto);
});
