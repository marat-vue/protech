import { AuditAction, OrderStatus, PaymentStatus } from "@prisma/client";
import { reserveProductStock, restoreProductStock } from "~~/server/utils/orderStock";
import { assertAdminOrderTransition } from "~~/server/utils/orderState";
import {
  broadcastOrderStatusChangeMessage,
  createOrderStatusChangeMessage
} from "~~/server/utils/orderStatusNotification";
import { updateOrderStatusSchema } from "~~/shared/schemas/admin/orders/updateOrderStatus";

export default defineEventHandler(async (event) => {
  const { userId } = await requireAdmin(event);

  const orderId = getPositiveIntRouterParam(event, "orderId", "Некорректный ID заказа");
  const body = await validateBody(event, updateOrderStatusSchema);

  const { statusMessage } = await prisma.$transaction(async (tx) => {
    const existingOrder = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        payment: {
          select: { paymentStatus: true }
        },
        orderItems: {
          select: { productId: true, quantity: true }
        }
      }
    });

    if (!existingOrder) {
      throw createError({
        statusCode: 404,
        message: "Заказ не найден"
      });
    }

    const nextOrderStatus = body.orderStatus as OrderStatus;
    assertAdminOrderTransition({
      current: existingOrder.orderStatus,
      next: nextOrderStatus,
      paymentMethod: existingOrder.paymentMethod,
      paymentStatus: existingOrder.payment?.paymentStatus ?? null
    });

    const orderData: { orderStatus: OrderStatus; stockReserved?: boolean } = {
      orderStatus: nextOrderStatus
    };

    if (
      existingOrder.orderStatus !== OrderStatus.CANCELLED &&
      nextOrderStatus === OrderStatus.CANCELLED
    ) {
      if (existingOrder.stockReserved) {
        await restoreProductStock(tx, existingOrder.orderItems, {
          orderId,
          reason: "Admin order cancelled"
        });
      }

      orderData.stockReserved = false;

      await tx.payment.updateMany({
        where: {
          orderId,
          paymentStatus: {
            in: [PaymentStatus.PENDING, PaymentStatus.UPON_RECEIPT]
          }
        },
        data: {
          paymentStatus: PaymentStatus.CANCELLED,
          paidAt: null
        }
      });
    }

    if (
      existingOrder.orderStatus === OrderStatus.PAYMENT_REVIEW &&
      new Set<OrderStatus>([OrderStatus.CONFIRMED, OrderStatus.PROCESSING]).has(nextOrderStatus) &&
      !existingOrder.stockReserved
    ) {
      await reserveProductStock(tx, existingOrder.orderItems, {
        orderId,
        reason: "Admin resolved payment review"
      });
      orderData.stockReserved = true;
    }

    if (nextOrderStatus === OrderStatus.COMPLETED) {
      await tx.delivery.updateMany({
        where: { orderId },
        data: { deliveredAt: new Date() }
      });
    }

    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: orderData,
      select: {
        id: true,
        userId: true,
        orderStatus: true,
        stockReserved: true
      }
    });

    const statusMessage = await createOrderStatusChangeMessage(tx, {
      orderId: updatedOrder.id,
      userId: updatedOrder.userId,
      previousStatus: existingOrder.orderStatus,
      nextStatus: updatedOrder.orderStatus
    });

    await recordAdminAudit({
      adminId: userId,
      action: AuditAction.ORDER_STATUS,
      entityType: "order",
      entityId: updatedOrder.id,
      summary: `Updated order ${updatedOrder.id} status`,
      metadata: {
        previousOrderStatus: existingOrder.orderStatus,
        orderStatus: updatedOrder.orderStatus,
        stockReserved: updatedOrder.stockReserved
      }
    }, tx, { suppressErrors: false });

    return { order: updatedOrder, statusMessage };
  }).catch((error) => {
    const prismaError = toPrismaHttpError(error, {
      P2025: "Заказ не найден"
    });

    if (prismaError) {
      throw prismaError;
    }

    throw error;
  });

  broadcastOrderStatusChangeMessage(statusMessage);

  return { success: true };
});
