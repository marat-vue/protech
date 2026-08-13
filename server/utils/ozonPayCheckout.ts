import {
  OrderStatus,
  PaymentCreationStatus,
  PaymentStatus
} from "@prisma/client";
import { createError, type H3Event } from "h3";
import { getOrderPaymentExpiresAt } from "./orderExpiry";
import { createOzonPayOrder, encodeOzonPayOrderId } from "./ozonPay";
import { prisma } from "./prisma";

const creationInProgressMessage =
  "Платёжная ссылка уже создаётся. Повторите запрос через несколько секунд";

export async function ensureOzonPayCheckout(event: H3Event, orderId: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      createdAt: true,
      orderStatus: true,
      payment: true
    }
  });

  if (!order?.payment) {
    throw createError({ statusCode: 404, message: "Платёж для заказа не найден" });
  }

  if (
    order.payment.paymentStatus === PaymentStatus.PAID ||
    order.payment.paymentStatus === PaymentStatus.PARTIALLY_REFUNDED ||
    order.payment.paymentStatus === PaymentStatus.REFUNDED
  ) {
    return {
      status: order.payment.providerStatus ?? "STATUS_PAID",
      confirmationUrl: null
    };
  }

  if (order.payment.confirmationUrl) {
    return {
      status: order.payment.providerStatus ?? "STATUS_PAYMENT_PENDING",
      confirmationUrl: order.payment.confirmationUrl
    };
  }

  if (
    order.orderStatus === OrderStatus.CANCELLED ||
    order.payment.paymentStatus === PaymentStatus.CANCELLED
  ) {
    throw createError({
      statusCode: 410,
      message: "Заказ отменён, платёжная ссылка больше недоступна"
    });
  }

  if (order.payment.creationStatus === PaymentCreationStatus.FAILED) {
    throw createError({
      statusCode: 409,
      message: "Платёжную ссылку создать не удалось. Заказ сохранён; обратитесь к менеджеру"
    });
  }

  if (order.payment.transactionId) {
    throw createError({
      statusCode: 409,
      message: "Платёж уже зарегистрирован у провайдера, но ссылка временно недоступна"
    });
  }

  if (order.payment.creationStatus === PaymentCreationStatus.CREATING) {
    throw createError({ statusCode: 409, message: creationInProgressMessage });
  }

  if (order.payment.creationStatus === PaymentCreationStatus.UNKNOWN) {
    throw createError({
      statusCode: 409,
      message: "Результат создания платежа уточняется. Новая попытка временно заблокирована"
    });
  }

  const claimed = await prisma.payment.updateMany({
    where: {
      id: order.payment.id,
      paymentStatus: PaymentStatus.PENDING,
      creationStatus: PaymentCreationStatus.NOT_STARTED,
      transactionId: null,
      confirmationUrl: null
    },
    data: {
      creationStatus: PaymentCreationStatus.CREATING,
      creationStartedAt: new Date(),
      lastError: null
    }
  });

  if (claimed.count !== 1) {
    throw createError({ statusCode: 409, message: creationInProgressMessage });
  }

  let ozonPayOrder;

  try {
    ozonPayOrder = await createOzonPayOrder(event, {
      orderId: order.id,
      amount: order.payment.amount,
      expiresAt: getOrderPaymentExpiresAt(order.createdAt)
    });
  } catch (error) {
    const statusCode = typeof error === "object" && error && "statusCode" in error
      ? Number(error.statusCode)
      : null;
    const creationStatus =
      !statusCode || statusCode === 502 || statusCode === 504
        ? PaymentCreationStatus.UNKNOWN
        : PaymentCreationStatus.FAILED;

    await prisma.payment.updateMany({
      where: {
        id: order.payment.id,
        creationStatus: PaymentCreationStatus.CREATING
      },
      data: {
        creationStatus,
        lastError: creationStatus === PaymentCreationStatus.UNKNOWN
          ? "Ozon Pay payment creation result is unknown"
          : "Ozon Pay payment creation failed before checkout was available"
      }
    });

    throw error;
  }

  const stored = await prisma.payment.updateMany({
    where: {
      id: order.payment.id,
      paymentStatus: PaymentStatus.PENDING,
      creationStatus: PaymentCreationStatus.CREATING
    },
    data: {
      transactionId: encodeOzonPayOrderId(ozonPayOrder.id),
      confirmationUrl: ozonPayOrder.payLink,
      providerStatus: ozonPayOrder.status,
      creationStatus: PaymentCreationStatus.READY,
      lastError: null
    }
  });

  if (stored.count !== 1) {
    const currentPayment = await prisma.payment.findUnique({
      where: { id: order.payment.id }
    });

    if (
      currentPayment &&
      new Set<PaymentStatus>([
        PaymentStatus.PAID,
        PaymentStatus.PARTIALLY_REFUNDED,
        PaymentStatus.REFUNDED
      ]).has(currentPayment.paymentStatus)
    ) {
      return {
        status: currentPayment.providerStatus ?? "STATUS_PAID",
        confirmationUrl: null
      };
    }

    if (
      currentPayment?.paymentStatus === PaymentStatus.PENDING &&
      currentPayment.transactionId === encodeOzonPayOrderId(ozonPayOrder.id)
    ) {
      await prisma.payment.update({
        where: { id: currentPayment.id },
        data: { confirmationUrl: ozonPayOrder.payLink }
      });

      return {
        status: currentPayment.providerStatus ?? ozonPayOrder.status,
        confirmationUrl: ozonPayOrder.payLink
      };
    }

    throw createError({
      statusCode: 409,
      message: "Состояние платежа изменилось во время создания ссылки"
    });
  }

  return {
    status: ozonPayOrder.status,
    confirmationUrl: ozonPayOrder.payLink
  };
}
