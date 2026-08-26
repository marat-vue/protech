import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildOzonPayCreateOrderBody,
  allocateOzonPayReceiptItems,
  createOzonPayHash,
  createOzonPayNotificationSignature,
  createOzonPayOrder,
  decodeOzonPayOrderId,
  encodeOzonPayOrderId,
  toOzonPayMinorUnits,
  verifyOzonPayNotificationSignature
} from "../server/utils/ozonPay";

const prismaMock = vi.hoisted(() => ({
  order: {
    findUnique: vi.fn()
  }
}));

vi.mock("../server/utils/prisma", () => ({
  prisma: prismaMock
}));

const orderFixture = {
  id: 42,
  user: {
    email: "buyer@example.com"
  },
  orderItems: [
    {
      id: 1,
      productId: 101,
      productName: "Фильтр гидравлический",
      productArticle: "PT-100",
      quantity: 2,
      price: new Prisma.Decimal("125.50")
    },
    {
      id: 2,
      productId: 202,
      productName: "Комплект уплотнений",
      productArticle: "PT-200",
      quantity: 1,
      price: new Prisma.Decimal("90.00")
    }
  ]
};

function mockRuntimeConfig() {
  vi.stubGlobal("useRuntimeConfig", () => ({
    ozonPayAccessKey: "access-key",
    ozonPaySecretKey: "secret-key",
    ozonPayNotificationSecretKey: "notification-secret",
    ozonPayApiUrl: "https://payapi.ozon.test",
    ozonPayVat: "VAT_NONE",
    ozonPayEnableFiscalization: "",
    public: {
      appUrl: "https://shop.example.com"
    }
  }));
}

describe("Ozon Pay Checkout", () => {
  beforeEach(() => {
    prismaMock.order.findUnique.mockReset();
    prismaMock.order.findUnique.mockResolvedValue(orderFixture);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockRuntimeConfig();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("matches the createOrder signature example from Ozon documentation", () => {
    expect(createOzonPayHash([
      "63fd43a4-f16d-4c3a-9bdf-50f2328781db",
      "2025-10-01T20:00:00.000Z",
      "MyOrderID-1",
      "FISCAL_TYPE_SINGLE",
      "PAY_ALGO_SMS",
      "643",
      "100",
      "PnHtbKc0lLiTlo4WITnWB44Qb1kpygRl"
    ])).toBe("406d29c45ffcb991eb40c3fbce98e714c1ed8963fee0024d7c3ba80dabc407bd");
  });

  it("converts rubles to integer kopecks", () => {
    expect(toOzonPayMinorUnits(new Prisma.Decimal("341.00"))).toBe("34100");
    expect(toOzonPayMinorUnits(new Prisma.Decimal("125.50"))).toBe("12550");
  });

  it("builds a full checkout order with items and signed return URLs", async () => {
    const body = await buildOzonPayCreateOrderBody({} as never, {
      orderId: 42,
      amount: new Prisma.Decimal("341.00"),
      expiresAt: new Date("2026-08-12T18:30:00.000Z")
    });

    expect(body).toMatchObject({
      accessKey: "access-key",
      amount: {
        currencyCode: "643",
        value: "34100"
      },
      extId: "42",
      mode: "MODE_FULL",
      paymentAlgorithm: "PAY_ALGO_SMS",
      fiscalizationType: "FISCAL_TYPE_SINGLE",
      receiptEmail: "buyer@example.com",
      successUrl: "https://shop.example.com/orders/42?payment=success",
      failUrl: "https://shop.example.com/orders/42?payment=failed",
      notificationUrl: "https://shop.example.com/api/public/payments/ozon/webhook"
    });
    expect(body.items).toEqual([
      expect.objectContaining({
        extId: "order-item-1",
        name: "Фильтр гидравлический (PT-100)",
        quantity: 2,
        price: { currencyCode: "643", value: "12550" },
        vat: "VAT_NONE"
      }),
      expect.objectContaining({
        extId: "order-item-2",
        quantity: 1,
        price: { currencyCode: "643", value: "9000" },
        vat: "VAT_NONE"
      })
    ]);
    expect(body.requestSign).toBe(createOzonPayHash([
      "access-key",
      "2026-08-12T18:30:00.000Z",
      "42",
      "FISCAL_TYPE_SINGLE",
      "PAY_ALGO_SMS",
      "643",
      "34100",
      "secret-key"
    ]));
  });

  it("distributes a promo discount across receipt items to the exact kopeck", () => {
    const items = allocateOzonPayReceiptItems(orderFixture.orderItems, new Prisma.Decimal("289.85"));
    const totalMinor = items.reduce((sum, item) => sum + item.priceMinor * item.quantity, 0);

    expect(totalMinor).toBe(28_985);
    expect(items.every((item) => item.priceMinor >= 1)).toBe(true);
    expect(items.reduce((sum, item) => sum + item.quantity, 0)).toBe(3);
  });

  it("posts the signed order and returns the hosted pay link", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      order: {
        id: "69f37767-8a8b-4de1-a601-384387aea8c4",
        extId: "42",
        payLink: "https://pay.ozon.ru/checkout/test-order",
        status: "STATUS_NEW",
        isTestMode: true
      }
    })));
    vi.stubGlobal("fetch", fetchMock);

    const order = await createOzonPayOrder({} as never, {
      orderId: 42,
      amount: new Prisma.Decimal("341.00"),
      expiresAt: new Date("2026-08-12T18:30:00.000Z")
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://payapi.ozon.test/v1/createOrder",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      })
    );
    expect(order.payLink).toBe("https://pay.ozon.ru/checkout/test-order");
  });

  it("does not expose provider response bodies to API clients", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ diagnostic: "provider-secret" }),
      { status: 400 }
    )));

    let caught: unknown;

    try {
      await createOzonPayOrder({} as never, {
        orderId: 42,
        amount: new Prisma.Decimal("341.00"),
        expiresAt: new Date("2026-08-12T18:30:00.000Z")
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({
      statusCode: 502,
      data: {
        provider: "ozon",
        status: 400
      }
    });
    expect(JSON.stringify(caught)).not.toContain("provider-secret");
  });

  it("matches and verifies the documented webhook signature", () => {
    const input = {
      orderID: "69f37767-8a8b-4de1-a601-384387aea8c4",
      transactionID: 6981437,
      extOrderID: "",
      amount: 52569,
      currencyCode: "643"
    };
    const signature = createOzonPayNotificationSignature(
      "1fac5a70-0ec4-4963-a33a-040ea301ea85",
      "4qEzUJjBoCXwA6P5NMyrJJUdA6xsnvbV",
      input
    );

    expect(signature).toBe("ae3c635dd72ec6b2c7833aa7458d57827895a57d4c35fba0e7dcb48f1d367d5f");
    expect(verifyOzonPayNotificationSignature(
      "1fac5a70-0ec4-4963-a33a-040ea301ea85",
      "4qEzUJjBoCXwA6P5NMyrJJUdA6xsnvbV",
      input,
      signature
    )).toBe(true);
    expect(verifyOzonPayNotificationSignature(
      "1fac5a70-0ec4-4963-a33a-040ea301ea85",
      "4qEzUJjBoCXwA6P5NMyrJJUdA6xsnvbV",
      input,
      "0".repeat(64)
    )).toBe(false);
  });

  it("stores Ozon order IDs with an explicit provider prefix", () => {
    const encoded = encodeOzonPayOrderId("69f37767-8a8b-4de1-a601-384387aea8c4");

    expect(encoded).toBe("ozon:69f37767-8a8b-4de1-a601-384387aea8c4");
    expect(decodeOzonPayOrderId(encoded)).toBe("69f37767-8a8b-4de1-a601-384387aea8c4");
    expect(decodeOzonPayOrderId("legacy-yookassa-id")).toBeNull();
  });
});
