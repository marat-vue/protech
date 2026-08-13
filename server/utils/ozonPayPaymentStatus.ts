import {
  OrderStatus,
  PaymentCreationStatus,
  PaymentStatus,
  Prisma,
  type Message
} from "@prisma/client";
import { createError, type H3Event } from "h3";
import { restoreOrderStock } from "./orderStock";
import { getOrderStatusAfterSuccessfulPayment } from "./orderState";
import { createProviderPaymentAudit } from "./paymentTransitionAudit";
import {
  broadcastOrderStatusChangeMessage,
  createOrderStatusChangeMessage
} from "./orderStatusNotification";
import {
  decodeOzonPayOrderId,
  encodeOzonPayOrderId,
  getOzonPayOrderStatus,
  type OzonPayOrderStatus
} from "./ozonPay";
import { prisma } from "./prisma";

export type OzonPayStatusInput = {
  id: string;
  extId?: string | null;
  status: OzonPayOrderStatus;
  originalAmount?: {
    currencyCode: string;
    value: string;
  } | null;
  remainingAmount?: {
    currencyCode: string;
    value: string;
  } | null;
};

type OzonPayStatusResult = {
  ok: true;
  status?: OzonPayOrderStatus;
  ignored?: true;
  reason?: string;
  alreadyProcessed?: true;
  processed?: true;
};

function ignored(reason: string): OzonPayStatusResult {
  return { ok: true, ignored: true, reason };
}

function getLocalOrderId(extId?: string | null) {
  const orderId = Number(extId);

  return Number.isInteger(orderId) && orderId > 0 ? orderId : null;
}

function getRefundedAmount(
  ozonOrder: OzonPayStatusInput,
  expectedAmount: Prisma.Decimal
) {
  if (ozonOrder.status === "STATUS_REFUNDED") {
    return expectedAmount;
  }

  if (!ozonOrder.remainingAmount) {
    return null;
  }

  if (ozonOrder.remainingAmount.currencyCode !== "643") {
    return null;
  }

  const remainingAmount = new Prisma.Decimal(ozonOrder.remainingAmount.value).div(100);

  if (remainingAmount.lt(0) || remainingAmount.gt(expectedAmount)) {
    return null;
  }

  return expectedAmount.sub(remainingAmount);
}

export async function applyOzonPayOrderStatus(
  ozonOrder: OzonPayStatusInput
): Promise<OzonPayStatusResult> {
  const localOrderId = getLocalOrderId(ozonOrder.extId);
  const encodedTransactionId = encodeOzonPayOrderId(ozonOrder.id);
  const paymentLookup: Prisma.PaymentWhereInput[] = [
    { transactionId: encodedTransactionId }
  ];

  if (localOrderId !== null) {
    paymentLookup.push({ orderId: localOrderId });
  }

  const existingPayment = await prisma.payment.findFirst({
    where: { OR: paymentLookup },
    include: {
      order: {
        select: {
          orderStatus: true,
          paymentMethod: true,
          stockReserved: true
        }
      }
    }
  });

  if (!existingPayment) {
    return ignored("Payment not found");
  }

  if (existingPayment.order.paymentMethod !== "ONLINE") {
    return ignored("Order is not an online payment order");
  }

  if (
    existingPayment.transactionId &&
    existingPayment.transactionId !== encodedTransactionId
  ) {
    return ignored("Payment transaction mismatch");
  }

  if (localOrderId !== null && localOrderId !== existingPayment.orderId) {
    return ignored("Payment order mismatch");
  }

  if (ozonOrder.originalAmount) {
    if (ozonOrder.originalAmount.currencyCode !== "643") {
      return ignored("Payment currency mismatch");
    }

    const expectedMinorUnits = new Prisma.Decimal(existingPayment.amount)
      .mul(100)
      .toFixed(0);

    if (expectedMinorUnits !== ozonOrder.originalAmount.value) {
      return ignored("Payment amount mismatch");
    }
  }

  const expectedAmount = new Prisma.Decimal(existingPayment.amount);

  if (ozonOrder.status === "STATUS_PAID") {
    if (existingPayment.paymentStatus === PaymentStatus.PAID) {
      return { ok: true, alreadyProcessed: true };
    }

    if (
      existingPayment.paymentStatus === PaymentStatus.REFUNDED ||
      existingPayment.paymentStatus === PaymentStatus.PARTIALLY_REFUNDED
    ) {
      return ignored("Payment has already been refunded");
    }

    let processed = false;
    let statusMessage: Message | null = null;

    await prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.updateMany({
        where: {
          id: existingPayment.id,
          paymentStatus: {
            in: [PaymentStatus.PENDING, PaymentStatus.CANCELLED]
          }
        },
        data: {
          transactionId: encodedTransactionId,
          paymentStatus: PaymentStatus.PAID,
          paidAt: new Date(),
          providerStatus: ozonOrder.status,
          creationStatus: PaymentCreationStatus.READY,
          lastError: null
        }
      });

      if (updatedPayment.count !== 1) {
        return;
      }

      const order = await tx.order.findUnique({
        where: { id: existingPayment.orderId },
        select: {
          orderStatus: true,
          userId: true,
          stockReserved: true
        }
      });

      if (!order) {
        throw createError({
          statusCode: 404,
          message: "Order is not available for payment confirmation"
        });
      }

      const nextOrderStatus = order.stockReserved
        ? getOrderStatusAfterSuccessfulPayment(order.orderStatus)
        : OrderStatus.PAYMENT_REVIEW;

      await tx.order.update({
        where: { id: existingPayment.orderId },
        data: {
          orderStatus: nextOrderStatus
        }
      });

      statusMessage = await createOrderStatusChangeMessage(tx, {
        orderId: existingPayment.orderId,
        userId: order.userId,
        previousStatus: order.orderStatus,
        nextStatus: nextOrderStatus
      });
      await createProviderPaymentAudit(tx, {
        paymentId: existingPayment.id,
        orderId: existingPayment.orderId,
        provider: "Ozon Pay",
        providerStatus: ozonOrder.status,
        previousPaymentStatus: existingPayment.paymentStatus,
        nextPaymentStatus: PaymentStatus.PAID,
        previousOrderStatus: order.orderStatus,
        nextOrderStatus
      });
      processed = true;
    });

    if (!processed) {
      return ignored("Payment cannot transition to paid");
    }

    broadcastOrderStatusChangeMessage(statusMessage);

    return { ok: true, processed: true };
  }

  if (
    ozonOrder.status === "STATUS_REFUNDED" ||
    ozonOrder.status === "STATUS_PARTITIONAL_REFUND" ||
    ozonOrder.status === "STATUS_PARTITION_CANCELED"
  ) {
    const refundedAmount = getRefundedAmount(ozonOrder, expectedAmount);

    if (!refundedAmount || refundedAmount.lte(0)) {
      return ignored("Refund amount is missing or invalid");
    }

    const isFullRefund = refundedAmount.equals(expectedAmount);
    const nextPaymentStatus = isFullRefund
      ? PaymentStatus.REFUNDED
      : PaymentStatus.PARTIALLY_REFUNDED;

    if (
      existingPayment.paymentStatus === nextPaymentStatus &&
      new Prisma.Decimal(existingPayment.refundedAmount).equals(refundedAmount)
    ) {
      return { ok: true, alreadyProcessed: true };
    }

    let processed = false;
    let statusMessage: Message | null = null;

    await prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.updateMany({
        where: {
          id: existingPayment.id,
          paymentStatus: {
            in: [
              PaymentStatus.PENDING,
              PaymentStatus.CANCELLED,
              PaymentStatus.PAID,
              PaymentStatus.PARTIALLY_REFUNDED
            ]
          }
        },
        data: {
          transactionId: encodedTransactionId,
          paymentStatus: nextPaymentStatus,
          refundedAmount,
          refundedAt: new Date(),
          providerStatus: ozonOrder.status,
          creationStatus: PaymentCreationStatus.READY,
          lastError: null
        }
      });

      if (updatedPayment.count !== 1) return;

      const order = await tx.order.findUnique({
        where: { id: existingPayment.orderId },
        select: {
          orderStatus: true,
          userId: true,
          stockReserved: true
        }
      });

      if (!order) return;

      let nextOrderStatus = order.orderStatus;
      let stockReserved = order.stockReserved;

      if (isFullRefund) {
        if (
          order.stockReserved &&
          new Set<OrderStatus>([
            OrderStatus.NEW,
            OrderStatus.CONFIRMED,
            OrderStatus.PROCESSING
          ]).has(order.orderStatus)
        ) {
          await restoreOrderStock(tx, existingPayment.orderId, "Ozon Pay payment refunded");
          stockReserved = false;
          nextOrderStatus = OrderStatus.CANCELLED;
        } else if (
          order.orderStatus !== OrderStatus.CANCELLED &&
          new Set<OrderStatus>([
            OrderStatus.SHIPPED,
            OrderStatus.COMPLETED
          ]).has(order.orderStatus)
        ) {
          nextOrderStatus = OrderStatus.PAYMENT_REVIEW;
        }
      } else if (order.orderStatus === OrderStatus.CANCELLED) {
        nextOrderStatus = OrderStatus.PAYMENT_REVIEW;
      }

      if (
        nextOrderStatus !== order.orderStatus ||
        stockReserved !== order.stockReserved
      ) {
        await tx.order.update({
          where: { id: existingPayment.orderId },
          data: { orderStatus: nextOrderStatus, stockReserved }
        });
      }

      statusMessage = await createOrderStatusChangeMessage(tx, {
        orderId: existingPayment.orderId,
        userId: order.userId,
        previousStatus: order.orderStatus,
        nextStatus: nextOrderStatus
      });
      await createProviderPaymentAudit(tx, {
        paymentId: existingPayment.id,
        orderId: existingPayment.orderId,
        provider: "Ozon Pay",
        providerStatus: ozonOrder.status,
        previousPaymentStatus: existingPayment.paymentStatus,
        nextPaymentStatus,
        previousOrderStatus: order.orderStatus,
        nextOrderStatus
      });
      processed = true;
    });

    if (!processed) return ignored("Refund cannot be applied");

    broadcastOrderStatusChangeMessage(statusMessage);
    return { ok: true, processed: true };
  }

  if (
    ozonOrder.status === "STATUS_CANCELED" ||
    ozonOrder.status === "STATUS_EXPIRED"
  ) {
    if (existingPayment.paymentStatus === PaymentStatus.CANCELLED) {
      return { ok: true, alreadyProcessed: true };
    }

    let processed = false;
    let statusMessage: Message | null = null;

    await prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.updateMany({
        where: {
          id: existingPayment.id,
          paymentStatus: PaymentStatus.PENDING
        },
        data: {
          transactionId: encodedTransactionId,
          paymentStatus: PaymentStatus.CANCELLED,
          paidAt: null,
          providerStatus: ozonOrder.status,
          creationStatus: PaymentCreationStatus.READY,
          lastError: null
        }
      });

      if (updatedPayment.count !== 1) {
        return;
      }

      const order = await tx.order.findUnique({
        where: { id: existingPayment.orderId },
        select: {
          orderStatus: true,
          userId: true,
          stockReserved: true
        }
      });

      if (order?.orderStatus !== OrderStatus.CANCELLED && order?.stockReserved) {
        await restoreOrderStock(tx, existingPayment.orderId, "Ozon Pay order cancelled");
      }

      await tx.order.update({
        where: { id: existingPayment.orderId },
        data: {
          orderStatus: OrderStatus.CANCELLED,
          stockReserved: false
        }
      });

      statusMessage = order
        ? await createOrderStatusChangeMessage(tx, {
            orderId: existingPayment.orderId,
            userId: order.userId,
            previousStatus: order.orderStatus,
            nextStatus: OrderStatus.CANCELLED
          })
        : null;
      if (order) {
        await createProviderPaymentAudit(tx, {
          paymentId: existingPayment.id,
          orderId: existingPayment.orderId,
          provider: "Ozon Pay",
          providerStatus: ozonOrder.status,
          previousPaymentStatus: existingPayment.paymentStatus,
          nextPaymentStatus: PaymentStatus.CANCELLED,
          previousOrderStatus: order.orderStatus,
          nextOrderStatus: OrderStatus.CANCELLED
        });
      }
      processed = true;
    });

    if (!processed) {
      return ignored("Payment is not pending");
    }

    broadcastOrderStatusChangeMessage(statusMessage);

    return { ok: true, processed: true };
  }

  await prisma.payment.updateMany({
    where: {
      id: existingPayment.id,
      paymentStatus: PaymentStatus.PENDING
    },
    data: {
      transactionId: encodedTransactionId,
      providerStatus: ozonOrder.status,
      creationStatus: PaymentCreationStatus.READY,
      lastError: null
    }
  });

  return {
    ok: true,
    status: ozonOrder.status
  };
}

export async function syncOzonPayOrderStatus(
  event: H3Event | undefined,
  transactionId: string
) {
  const ozonOrderId = decodeOzonPayOrderId(transactionId);

  if (!ozonOrderId) {
    return ignored("Not an Ozon Pay transaction");
  }

  const ozonOrder = await getOzonPayOrderStatus(event, ozonOrderId);

  return applyOzonPayOrderStatus(ozonOrder);
}
