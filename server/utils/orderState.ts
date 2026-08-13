import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus
} from "@prisma/client";
import { createError } from "h3";

const transitions: Record<OrderStatus, ReadonlySet<OrderStatus>> = {
  [OrderStatus.NEW]: new Set([
    OrderStatus.CONFIRMED,
    OrderStatus.PAYMENT_REVIEW,
    OrderStatus.CANCELLED
  ]),
  [OrderStatus.CONFIRMED]: new Set([
    OrderStatus.PROCESSING,
    OrderStatus.PAYMENT_REVIEW,
    OrderStatus.CANCELLED
  ]),
  [OrderStatus.PROCESSING]: new Set([
    OrderStatus.SHIPPED,
    OrderStatus.PAYMENT_REVIEW,
    OrderStatus.CANCELLED
  ]),
  [OrderStatus.SHIPPED]: new Set([
    OrderStatus.COMPLETED,
    OrderStatus.PAYMENT_REVIEW
  ]),
  [OrderStatus.COMPLETED]: new Set([
    OrderStatus.PAYMENT_REVIEW
  ]),
  [OrderStatus.PAYMENT_REVIEW]: new Set([
    OrderStatus.CONFIRMED,
    OrderStatus.PROCESSING,
    OrderStatus.CANCELLED
  ]),
  [OrderStatus.CANCELLED]: new Set()
};

const settledOnlineStatuses = new Set<PaymentStatus>([
  PaymentStatus.PAID,
  PaymentStatus.PARTIALLY_REFUNDED
]);

export function getOrderStatusAfterSuccessfulPayment(current: OrderStatus) {
  if (current === OrderStatus.NEW) return OrderStatus.CONFIRMED;
  if (current === OrderStatus.CANCELLED) return OrderStatus.PAYMENT_REVIEW;
  return current;
}

export function assertAdminOrderTransition(input: {
  current: OrderStatus;
  next: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus | null;
}) {
  if (input.current === input.next) return;

  if (!transitions[input.current].has(input.next)) {
    throw createError({
      statusCode: 409,
      message: `Переход заказа ${input.current} → ${input.next} запрещён`
    });
  }

  if (
    input.next === OrderStatus.CANCELLED &&
    (input.paymentStatus === PaymentStatus.PAID ||
      input.paymentStatus === PaymentStatus.PARTIALLY_REFUNDED)
  ) {
    throw createError({
      statusCode: 409,
      message: "Сначала подтвердите возврат оплаченного платежа"
    });
  }

  const requiresOnlinePayment = new Set<OrderStatus>([
    OrderStatus.PROCESSING,
    OrderStatus.SHIPPED,
    OrderStatus.COMPLETED
  ]).has(input.next);

  if (
    requiresOnlinePayment &&
    input.paymentMethod === PaymentMethod.ONLINE &&
    (!input.paymentStatus || !settledOnlineStatuses.has(input.paymentStatus))
  ) {
    throw createError({
      statusCode: 409,
      message: "Нельзя обрабатывать или завершать заказ до подтверждения онлайн-оплаты"
    });
  }

  if (
    input.next === OrderStatus.COMPLETED &&
    input.paymentMethod === PaymentMethod.OFFLINE &&
    input.paymentStatus !== PaymentStatus.PAID
  ) {
    throw createError({
      statusCode: 409,
      message: "Перед завершением заказа отметьте оплату при получении"
    });
  }
}

export function assertAdminPaymentTransition(input: {
  paymentMethod: PaymentMethod;
  current: PaymentStatus;
  next: PaymentStatus;
}) {
  if (input.current === input.next) return;

  if (input.paymentMethod === PaymentMethod.ONLINE) {
    throw createError({
      statusCode: 409,
      message: "Статус онлайн-платежа изменяется только по данным платёжного провайдера"
    });
  }

  const allowed = new Set<PaymentStatus>();

  if (input.current === PaymentStatus.UPON_RECEIPT) {
    allowed.add(PaymentStatus.PAID);
    allowed.add(PaymentStatus.CANCELLED);
  } else if (input.current === PaymentStatus.PAID) {
    allowed.add(PaymentStatus.REFUNDED);
  }

  if (!allowed.has(input.next)) {
    throw createError({
      statusCode: 409,
      message: `Переход платежа ${input.current} → ${input.next} запрещён`
    });
  }
}
