import { AuditAction, OrderStatus, PaymentStatus } from "@prisma/client";
import { restoreProductStock } from "~~/server/utils/orderStock";
import { assertAdminPaymentTransition } from "~~/server/utils/orderState";
import {
  broadcastOrderStatusChangeMessage,
  createOrderStatusChangeMessage
} from "~~/server/utils/orderStatusNotification";
import { updatePaymentStatusSchema } from "~~/shared/schemas/admin/orders/updatePaymentStatus";

export default defineEventHandler(async (event) => {
  const { userId } = await requireAdmin(event);
  const body = await validateBody(event, updatePaymentStatusSchema);
  const nextPaymentStatus = body.paymentStatus as PaymentStatus;

  const { statusMessage } = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { orderId: body.orderId },
      include: {
        order: {
          select: {
            id: true,
            userId: true,
            paymentMethod: true,
            orderStatus: true,
            stockReserved: true,
            orderItems: {
              select: { productId: true, quantity: true }
            }
          }
        }
      }
    });

    if (!payment) {
      throw createError({
        statusCode: 404,
        message: "Платёж для заказа не найден"
      });
    }

    assertAdminPaymentTransition({
      paymentMethod: payment.order.paymentMethod,
      current: payment.paymentStatus,
      next: nextPaymentStatus
    });

    let nextOrderStatus: OrderStatus | null = null;

    if (nextPaymentStatus === PaymentStatus.CANCELLED) {
      if (payment.order.stockReserved) {
        await restoreProductStock(tx, payment.order.orderItems, {
          orderId: payment.order.id,
          reason: "Admin payment cancelled"
        });
      }

      await tx.order.update({
        where: { id: payment.order.id },
        data: {
          orderStatus: OrderStatus.CANCELLED,
          stockReserved: false
        }
      });
      nextOrderStatus = OrderStatus.CANCELLED;
    } else if (
      nextPaymentStatus === PaymentStatus.PAID &&
      payment.order.orderStatus === OrderStatus.NEW
    ) {
      await tx.order.update({
        where: { id: payment.order.id },
        data: { orderStatus: OrderStatus.CONFIRMED }
      });
      nextOrderStatus = OrderStatus.CONFIRMED;
    } else if (nextPaymentStatus === PaymentStatus.REFUNDED) {
      if (
        payment.order.orderStatus === OrderStatus.SHIPPED ||
        payment.order.orderStatus === OrderStatus.COMPLETED
      ) {
        await tx.order.update({
          where: { id: payment.order.id },
          data: { orderStatus: OrderStatus.PAYMENT_REVIEW }
        });
        nextOrderStatus = OrderStatus.PAYMENT_REVIEW;
      } else {
        if (payment.order.stockReserved) {
          await restoreProductStock(tx, payment.order.orderItems, {
            orderId: payment.order.id,
            reason: "Admin payment refunded"
          });
        }

        await tx.order.update({
          where: { id: payment.order.id },
          data: {
            orderStatus: OrderStatus.CANCELLED,
            stockReserved: false
          }
        });
        nextOrderStatus = OrderStatus.CANCELLED;
      }
    }

    const updatedPayment = await tx.payment.update({
      where: { orderId: body.orderId },
      data: {
        paymentStatus: nextPaymentStatus,
        paidAt:
          nextPaymentStatus === PaymentStatus.PAID
            ? new Date()
            : nextPaymentStatus === PaymentStatus.CANCELLED
              ? null
              : payment.paidAt,
        refundedAmount:
          nextPaymentStatus === PaymentStatus.REFUNDED
            ? payment.amount
            : payment.refundedAmount,
        refundedAt:
          nextPaymentStatus === PaymentStatus.REFUNDED
            ? new Date()
            : payment.refundedAt
      },
      select: {
        id: true,
        orderId: true,
        paymentStatus: true,
        refundedAmount: true
      }
    });

    const statusMessage = nextOrderStatus && nextOrderStatus !== payment.order.orderStatus
      ? await createOrderStatusChangeMessage(tx, {
          orderId: payment.order.id,
          userId: payment.order.userId,
          previousStatus: payment.order.orderStatus,
          nextStatus: nextOrderStatus
        })
      : null;

    await recordAdminAudit({
      adminId: userId,
      action: AuditAction.PAYMENT_STATUS,
      entityType: "payment",
      entityId: updatedPayment.id,
      summary: `Updated payment for order ${updatedPayment.orderId}`,
      metadata: {
        orderId: updatedPayment.orderId,
        previousPaymentStatus: payment.paymentStatus,
        paymentStatus: updatedPayment.paymentStatus,
        refundedAmount: updatedPayment.refundedAmount.toString()
      }
    }, tx, { suppressErrors: false });

    if (nextOrderStatus && nextOrderStatus !== payment.order.orderStatus) {
      await recordAdminAudit({
        adminId: userId,
        action: AuditAction.ORDER_STATUS,
        entityType: "order",
        entityId: payment.order.id,
        summary: `Payment update changed order ${payment.order.id} status`,
        metadata: {
          previousOrderStatus: payment.order.orderStatus,
          orderStatus: nextOrderStatus,
          paymentStatus: updatedPayment.paymentStatus
        }
      }, tx, { suppressErrors: false });
    }

    return { statusMessage };
  }).catch((error) => {
    const prismaError = toPrismaHttpError(error, {
      P2025: "Платёж или заказ не найден"
    });

    if (prismaError) {
      throw prismaError;
    }

    throw error;
  });

  broadcastOrderStatusChangeMessage(statusMessage);

  return { success: true };
});
