import {
  OrderStatus,
  PaymentStatus,
  Prisma
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyOzonPayOrderStatus } from "../server/utils/ozonPayPaymentStatus";

const mocks = vi.hoisted(() => ({
  paymentFindFirst: vi.fn(),
  paymentUpdateMany: vi.fn(),
  orderFindUnique: vi.fn(),
  orderUpdate: vi.fn(),
  restoreOrderStock: vi.fn(),
  createStatusMessage: vi.fn(),
  createPaymentAudit: vi.fn()
}));

vi.mock("../server/utils/prisma", () => {
  const tx = {
    payment: { updateMany: mocks.paymentUpdateMany },
    order: {
      findUnique: mocks.orderFindUnique,
      update: mocks.orderUpdate
    }
  };

  return {
    prisma: {
      payment: {
        findFirst: mocks.paymentFindFirst,
        updateMany: mocks.paymentUpdateMany
      },
      $transaction: vi.fn((callback) => callback(tx))
    }
  };
});

vi.mock("../server/utils/orderStock", () => ({
  restoreOrderStock: mocks.restoreOrderStock
}));

vi.mock("../server/utils/orderStatusNotification", () => ({
  broadcastOrderStatusChangeMessage: vi.fn(),
  createOrderStatusChangeMessage: mocks.createStatusMessage
}));

vi.mock("../server/utils/paymentTransitionAudit", () => ({
  createProviderPaymentAudit: mocks.createPaymentAudit
}));

function paymentFixture(input: {
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  stockReserved: boolean;
}) {
  return {
    id: 5,
    orderId: 42,
    transactionId: "ozon:provider-42",
    amount: new Prisma.Decimal("100.00"),
    refundedAmount: new Prisma.Decimal(0),
    paymentStatus: input.paymentStatus,
    order: {
      paymentMethod: "ONLINE",
      orderStatus: input.orderStatus,
      stockReserved: input.stockReserved
    }
  };
}

describe("Ozon Pay status reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.paymentUpdateMany.mockResolvedValue({ count: 1 });
    mocks.orderUpdate.mockResolvedValue({});
    mocks.createStatusMessage.mockResolvedValue(null);
    mocks.createPaymentAudit.mockResolvedValue(undefined);
  });

  it("does not silently reconfirm a late payment after stock was released", async () => {
    mocks.paymentFindFirst.mockResolvedValue(paymentFixture({
      paymentStatus: PaymentStatus.CANCELLED,
      orderStatus: OrderStatus.CANCELLED,
      stockReserved: false
    }));
    mocks.orderFindUnique.mockResolvedValue({
      orderStatus: OrderStatus.CANCELLED,
      userId: "user-1",
      stockReserved: false
    });

    const result = await applyOzonPayOrderStatus({
      id: "provider-42",
      extId: "42",
      status: "STATUS_PAID",
      originalAmount: { currencyCode: "643", value: "10000" }
    });

    expect(result.processed).toBe(true);
    expect(mocks.orderUpdate).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { orderStatus: OrderStatus.PAYMENT_REVIEW }
    });
    expect(mocks.restoreOrderStock).not.toHaveBeenCalled();
  });

  it("restores stock and cancels an unfulfilled fully refunded order", async () => {
    mocks.paymentFindFirst.mockResolvedValue(paymentFixture({
      paymentStatus: PaymentStatus.PAID,
      orderStatus: OrderStatus.CONFIRMED,
      stockReserved: true
    }));
    mocks.orderFindUnique.mockResolvedValue({
      orderStatus: OrderStatus.CONFIRMED,
      userId: "user-1",
      stockReserved: true
    });

    const result = await applyOzonPayOrderStatus({
      id: "provider-42",
      extId: "42",
      status: "STATUS_REFUNDED",
      originalAmount: { currencyCode: "643", value: "10000" }
    });

    expect(result.processed).toBe(true);
    expect(mocks.restoreOrderStock).toHaveBeenCalledWith(
      expect.anything(),
      42,
      "Ozon Pay payment refunded"
    );
    expect(mocks.orderUpdate).toHaveBeenCalledWith({
      where: { id: 42 },
      data: {
        orderStatus: OrderStatus.CANCELLED,
        stockReserved: false
      }
    });
  });

  it("records a partial refund using the provider remaining amount", async () => {
    mocks.paymentFindFirst.mockResolvedValue(paymentFixture({
      paymentStatus: PaymentStatus.PAID,
      orderStatus: OrderStatus.SHIPPED,
      stockReserved: true
    }));
    mocks.orderFindUnique.mockResolvedValue({
      orderStatus: OrderStatus.SHIPPED,
      userId: "user-1",
      stockReserved: true
    });

    const result = await applyOzonPayOrderStatus({
      id: "provider-42",
      extId: "42",
      status: "STATUS_PARTITIONAL_REFUND",
      originalAmount: { currencyCode: "643", value: "10000" },
      remainingAmount: { currencyCode: "643", value: "6000" }
    });

    expect(result.processed).toBe(true);
    const update = mocks.paymentUpdateMany.mock.calls[0]?.[0];
    expect(update.data.paymentStatus).toBe(PaymentStatus.PARTIALLY_REFUNDED);
    expect(update.data.refundedAmount.toString()).toBe("40");
    expect(mocks.orderUpdate).not.toHaveBeenCalled();
  });
});
