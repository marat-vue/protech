import {
  OrderStatus,
  PaymentCreationStatus,
  PaymentMethod,
  PaymentStatus,
  type Message
} from "@prisma/client";
import type { H3Event } from "h3";
import { prisma } from "./prisma";
import { restoreProductStock } from "./orderStock";
import { syncOnlinePaymentStatus } from "./onlinePaymentStatus";
import {
  broadcastOrderStatusChangeMessage,
  createOrderStatusChangeMessage
} from "./orderStatusNotification";
import { getPositiveIntegerEnv } from "./env";

export type ExpireUnpaidOrdersOptions = {
  expiresBefore?: Date;
  now?: Date;
  batchSize?: number;
  event?: H3Event;
};

export type ExpireUnpaidOrdersResult = {
  checked: number;
  expired: number;
  orderIds: number[];
};

export function getOrderPaymentExpiryMinutes() {
  return getPositiveIntegerEnv("ORDER_PAYMENT_EXPIRY_MINUTES", 10);
}

export function getOrderPaymentExpiresAt(createdAt: Date) {
  return new Date(createdAt.getTime() + getOrderPaymentExpiryMinutes() * 60_000);
}

export function getOrderPaymentRemainingSeconds(createdAt: Date, now = new Date()) {
  return Math.max(0, Math.ceil((getOrderPaymentExpiresAt(createdAt).getTime() - now.getTime()) / 1000));
}

function getDefaultExpiresBefore(now: Date) {
  const ttlMinutes = getOrderPaymentExpiryMinutes();

  return new Date(now.getTime() - ttlMinutes * 60_000);
}

export async function expireUnpaidOrders(
  options: ExpireUnpaidOrdersOptions = {}
): Promise<ExpireUnpaidOrdersResult> {
  const now = options.now ?? new Date();
  const expiresBefore = options.expiresBefore ?? getDefaultExpiresBefore(now);
  const batchSize = options.batchSize ?? getPositiveIntegerEnv("ORDER_EXPIRY_BATCH_SIZE", 100);

  const candidates = await prisma.order.findMany({
    where: {
      paymentMethod: PaymentMethod.ONLINE,
      orderStatus: { not: OrderStatus.CANCELLED },
      stockReserved: true,
      createdAt: { lte: expiresBefore },
      payment: {
        is: {
          paymentStatus: PaymentStatus.PENDING
        }
      }
    },
    select: {
      id: true,
      payment: {
        select: {
          transactionId: true,
          creationStatus: true
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    },
    take: batchSize
  });

  const expiredOrderIds: number[] = [];

  for (const candidate of candidates) {
    if (candidate.payment?.transactionId) {
      try {
        await syncOnlinePaymentStatus(options.event, candidate.payment.transactionId);
      } catch (error) {
        console.error("Failed to reconcile online payment before expiry", {
          orderId: candidate.id,
          error
        });
      }

      // A provider-registered payment must only be closed from provider state.
      // This avoids releasing stock while a delayed success callback is in flight.
      continue;
    }

    if (
      candidate.payment?.creationStatus === PaymentCreationStatus.CREATING ||
      candidate.payment?.creationStatus === PaymentCreationStatus.UNKNOWN ||
      candidate.payment?.creationStatus === PaymentCreationStatus.READY
    ) {
      let statusMessage: Message | null = null;

      await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: candidate.id },
          select: {
            orderStatus: true,
            userId: true
          }
        });

        if (!order || order.orderStatus === OrderStatus.PAYMENT_REVIEW) {
          return;
        }

        const updated = await tx.order.updateMany({
          where: {
            id: candidate.id,
            orderStatus: { not: OrderStatus.CANCELLED },
            payment: {
              is: {
                paymentStatus: PaymentStatus.PENDING,
                transactionId: null,
                creationStatus: {
                  in: [
                    PaymentCreationStatus.CREATING,
                    PaymentCreationStatus.UNKNOWN,
                    PaymentCreationStatus.READY
                  ]
                }
              }
            }
          },
          data: {
            orderStatus: OrderStatus.PAYMENT_REVIEW
          }
        });

        if (updated.count === 1) {
          statusMessage = await createOrderStatusChangeMessage(tx, {
            orderId: candidate.id,
            userId: order.userId,
            previousStatus: order.orderStatus,
            nextStatus: OrderStatus.PAYMENT_REVIEW
          });
        }
      });

      broadcastOrderStatusChangeMessage(statusMessage);
      continue;
    }

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: candidate.id },
        include: {
          orderItems: {
            select: {
              productId: true,
              quantity: true
            }
          },
          payment: {
            select: {
              paymentStatus: true,
              creationStatus: true,
              transactionId: true
            }
          }
        }
      });

      if (
        !order ||
        order.paymentMethod !== PaymentMethod.ONLINE ||
        order.orderStatus === OrderStatus.CANCELLED ||
        !order.stockReserved ||
        order.createdAt > expiresBefore ||
        order.payment?.paymentStatus !== PaymentStatus.PENDING ||
        order.payment.transactionId !== null ||
        !new Set<PaymentCreationStatus>([
          PaymentCreationStatus.NOT_STARTED,
          PaymentCreationStatus.FAILED
        ]).has(order.payment.creationStatus)
      ) {
        return { expired: false, statusMessage: null };
      }

      const claimed = await tx.order.updateMany({
        where: {
          id: order.id,
          paymentMethod: PaymentMethod.ONLINE,
          orderStatus: { not: OrderStatus.CANCELLED },
          stockReserved: true,
          createdAt: { lte: expiresBefore },
          payment: {
            is: {
              paymentStatus: PaymentStatus.PENDING,
              transactionId: null,
              creationStatus: {
                in: [
                  PaymentCreationStatus.NOT_STARTED,
                  PaymentCreationStatus.FAILED
                ]
              }
            }
          }
        },
        data: {
          orderStatus: OrderStatus.CANCELLED,
          stockReserved: false
        }
      });

      if (claimed.count !== 1) {
        return { expired: false, statusMessage: null };
      }

      await restoreProductStock(tx, order.orderItems, {
        orderId: order.id,
        reason: "Unpaid order expired"
      });

      await tx.payment.update({
        where: { orderId: order.id },
        data: {
          paymentStatus: PaymentStatus.CANCELLED,
          paidAt: null
        }
      });

      const statusMessage = await createOrderStatusChangeMessage(tx, {
        orderId: order.id,
        userId: order.userId,
        previousStatus: order.orderStatus,
        nextStatus: OrderStatus.CANCELLED
      });

      return { expired: true, statusMessage };
    });

    if (result.expired) {
      expiredOrderIds.push(candidate.id);
      broadcastOrderStatusChangeMessage(result.statusMessage);
    }
  }

  return {
    checked: candidates.length,
    expired: expiredOrderIds.length,
    orderIds: expiredOrderIds
  };
}
