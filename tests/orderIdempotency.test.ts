import { describe, expect, it } from "vitest";
import {
  assertOrderIdempotencyKey,
  createOrderRequestFingerprint
} from "../server/utils/orderIdempotency";

describe("order idempotency", () => {
  it("produces the same fingerprint for objects with different key order", () => {
    const left = {
      paymentMethod: "ONLINE",
      orderItems: [{ productId: 10, quantity: 2 }],
      recipient: { phone: "+7 900 000-00-00", name: "Иван" }
    };
    const right = {
      recipient: { name: "Иван", phone: "+7 900 000-00-00" },
      orderItems: [{ quantity: 2, productId: 10 }],
      paymentMethod: "ONLINE"
    };

    expect(createOrderRequestFingerprint(left)).toBe(createOrderRequestFingerprint(right));
  });

  it("changes the fingerprint when order contents change", () => {
    const first = { orderItems: [{ productId: 10, quantity: 1 }] };
    const second = { orderItems: [{ productId: 10, quantity: 2 }] };

    expect(createOrderRequestFingerprint(first)).not.toBe(createOrderRequestFingerprint(second));
  });

  it("accepts strong keys and rejects missing or malformed keys", () => {
    expect(assertOrderIdempotencyKey(" 8bb9a3f7-74f9-4e7d-a816-19f7cc61f06d "))
      .toBe("8bb9a3f7-74f9-4e7d-a816-19f7cc61f06d");
    expect(() => assertOrderIdempotencyKey(undefined)).toThrow(/Idempotency-Key/);
    expect(() => assertOrderIdempotencyKey("short")).toThrow(/Idempotency-Key/);
    expect(() => assertOrderIdempotencyKey("invalid key with spaces")).toThrow(/Idempotency-Key/);
  });
});
