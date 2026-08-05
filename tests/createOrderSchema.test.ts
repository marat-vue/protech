import { describe, expect, it } from "vitest";
import { createOrderSchema } from "../shared/schemas/user/orders/createOrder";

function createDeliveryOrder(overrides: Record<string, unknown> = {}) {
  return {
    obtainingMethod: "DELIVERY",
    paymentMethod: "ONLINE",
    customerPhone: "+79001234567",
    orderItems: [
      {
        productId: 1,
        quantity: 1
      }
    ],
    delivery: {
      address: "Yaroslavl, Test street, 1",
      deliveryMethod: "OZON",
      ...overrides
    }
  };
}

describe("create order schema delivery methods", () => {
  it("accepts CDEK delivery orders", () => {
    const result = createOrderSchema.safeParse(createDeliveryOrder({
      deliveryMethod: "CDEK"
    }));

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.delivery.deliveryMethod).toBe("CDEK");
    }
  });

  it("defaults delivery method to OZON", () => {
    const order = createDeliveryOrder();
    delete (order.delivery as Partial<typeof order.delivery>).deliveryMethod;
    const result = createOrderSchema.safeParse(order);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.delivery.deliveryMethod).toBe("OZON");
    }
  });

  it("rejects unknown delivery services", () => {
    const result = createOrderSchema.safeParse(createDeliveryOrder({
      deliveryMethod: "PICKPOINT"
    }));

    expect(result.success).toBe(false);
  });
});
