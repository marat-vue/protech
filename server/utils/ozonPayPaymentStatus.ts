import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  type Message
} from "@prisma/client";
import { createError, type H3Event } from "h3";
import { reserveOrderStock, restoreOrderStock } from "./orderStock";
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

  if (ozonOrder.status === "STATUS_PAID") {
    if (existingPayment.paymentStatus === PaymentStatus.PAID) {
      return { ok: true, alreadyProcessed: true };
    }

    let processed = false;
    let statusMessage: Message | null = null;

    await prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.updateMany({
        where: {
          id: existingPayment.id,
          paymentStatus: PaymentStatus.PENDING,
          order: {
            is: {
              orderStatus: { not: OrderStatus.CANCELLED }
            }
          }
        },
        data: {
          transactionId: encodedTransactionId,
          paymentStatus: PaymentStatus.PAID,
          paidAt: new Date()
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

      if (!order || order.orderStatus === OrderStatus.CANCELLED) {
        throw createError({
          statusCode: 409,
          message: "Order is not available for payment confirmation"
        });
      }

      if (!order.stockReserved) {
        await reserveOrderStock(tx, existingPayment.orderId);
      }

      await tx.order.update({
        where: { id: existingPayment.orderId },
        data: {
          orderStatus: OrderStatus.CONFIRMED,
          stockReserved: true
        }
      });

      statusMessage = await createOrderStatusChangeMessage(tx, {
        orderId: existingPayment.orderId,
        userId: order.userId,
        previousStatus: order.orderStatus,
        nextStatus: OrderStatus.CONFIRMED
      });
      processed = true;
    });

    if (!processed) {
      return ignored("Payment is not pending or order is cancelled");
    }

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
          paidAt: null
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
      processed = true;
    });

    if (!processed) {
      return ignored("Payment is not pending");
    }

    broadcastOrderStatusChangeMessage(statusMessage);

    return { ok: true, processed: true };
  }

  return {
    ok: true,
    status: ozonOrder.status
  };
}

export async function syncOzonPayOrderStatus(
  event: H3Event,
  transactionId: string
) {
  const ozonOrderId = decodeOzonPayOrderId(transactionId);

  if (!ozonOrderId) {
    return ignored("Not an Ozon Pay transaction");
  }

  const ozonOrder = await getOzonPayOrderStatus(event, ozonOrderId);

  return applyOzonPayOrderStatus(ozonOrder);
}
