import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus
} from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  assertAdminOrderTransition,
  assertAdminPaymentTransition,
  getOrderStatusAfterSuccessfulPayment
} from "../server/utils/orderState";

describe("order and payment state guards", () => {
  it("routes a late paid cancellation to payment review", () => {
    expect(getOrderStatusAfterSuccessfulPayment(OrderStatus.CANCELLED))
      .toBe(OrderStatus.PAYMENT_REVIEW);
    expect(getOrderStatusAfterSuccessfulPayment(OrderStatus.NEW))
      .toBe(OrderStatus.CONFIRMED);
  });

  it("blocks shipping an unpaid online order", () => {
    expect(() => assertAdminOrderTransition({
      current: OrderStatus.CONFIRMED,
      next: OrderStatus.PROCESSING,
      paymentMethod: PaymentMethod.ONLINE,
      paymentStatus: PaymentStatus.PENDING
    })).toThrow(/онлайн-оплаты/);
  });

  it("blocks cancelling paid orders until a refund is confirmed", () => {
    expect(() => assertAdminOrderTransition({
      current: OrderStatus.CONFIRMED,
      next: OrderStatus.CANCELLED,
      paymentMethod: PaymentMethod.ONLINE,
      paymentStatus: PaymentStatus.PAID
    })).toThrow(/возврат/);
  });

  it("allows a refunded order to be cancelled", () => {
    expect(() => assertAdminOrderTransition({
      current: OrderStatus.PAYMENT_REVIEW,
      next: OrderStatus.CANCELLED,
      paymentMethod: PaymentMethod.ONLINE,
      paymentStatus: PaymentStatus.REFUNDED
    })).not.toThrow();
  });

  it("allows manual status changes only for offline payments", () => {
    expect(() => assertAdminPaymentTransition({
      paymentMethod: PaymentMethod.ONLINE,
      current: PaymentStatus.PENDING,
      next: PaymentStatus.PAID
    })).toThrow(/провайдера/);

    expect(() => assertAdminPaymentTransition({
      paymentMethod: PaymentMethod.OFFLINE,
      current: PaymentStatus.UPON_RECEIPT,
      next: PaymentStatus.PAID
    })).not.toThrow();
  });
});
