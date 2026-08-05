import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildYooKassaReceipt,
  createYooKassaPayment,
  getYooKassaReceiptTotal
} from "../server/utils/yookassa";

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
      productName: "Фильтр гидравлический",
      productArticle: "PT-100",
      quantity: 2,
      price: new Prisma.Decimal("125.50")
    },
    {
      id: 2,
      productName: "Комплект уплотнений",
      productArticle: "PT-200",
      quantity: 1,
      price: new Prisma.Decimal("90.00")
    }
  ]
};

function mockRuntimeConfig() {
  vi.stubGlobal("useRuntimeConfig", () => ({
    yookassaShopId: "123456",
    yookassaSecretKey: "secret",
    yookassaApiUrl: "https://api.yookassa.test",
    yookassaReturnUrl: "",
    public: {
      appUrl: "https://shop.example.com"
    }
  }));
}

describe("YooKassa receipt", () => {
  beforeEach(() => {
    prismaMock.order.findUnique.mockReset();
    prismaMock.order.findUnique.mockResolvedValue(orderFixture);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockRuntimeConfig();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("builds receipt from order items and customer email", async () => {
    const receipt = await buildYooKassaReceipt(42);

    expect(receipt).toEqual({
      customer: {
        email: "buyer@example.com"
      },
      items: [
        {
          description: "Фильтр гидравлический (PT-100)",
          quantity: 2,
          amount: {
            value: "125.50",
            currency: "RUB"
          },
          vat_code: 1,
          payment_mode: "full_prepayment",
          payment_subject: "commodity",
          measure: "piece"
        },
        {
          description: "Комплект уплотнений (PT-200)",
          quantity: 1,
          amount: {
            value: "90.00",
            currency: "RUB"
          },
          vat_code: 1,
          payment_mode: "full_prepayment",
          payment_subject: "commodity",
          measure: "piece"
        }
      ],
      internet: "true"
    });
    expect(getYooKassaReceiptTotal(receipt).toFixed(2)).toBe("341.00");
  });

  it("uses fiscal receipt environment values", async () => {
    vi.stubEnv("YOOKASSA_RECEIPT_VAT_CODE", "11");
    vi.stubEnv("YOOKASSA_RECEIPT_TAX_SYSTEM_CODE", "2");
    vi.stubEnv("YOOKASSA_RECEIPT_PAYMENT_MODE", "full_payment");
    vi.stubEnv("YOOKASSA_RECEIPT_PAYMENT_SUBJECT", "non_marked");

    const receipt = await buildYooKassaReceipt(42);

    expect(receipt.items[0]).toMatchObject({
      vat_code: 11,
      payment_mode: "full_payment",
      payment_subject: "non_marked"
    });
    expect(receipt.tax_system_code).toBe(2);
  });

  it("sends receipt when creating payment", async () => {
    const paymentResponse = {
      id: "payment-id",
      status: "pending",
      paid: false,
      amount: {
        value: "341.00",
        currency: "RUB"
      },
      confirmation: {
        type: "redirect",
        confirmation_url: "https://yookassa.example/confirm"
      },
      metadata: {
        orderId: "42"
      }
    };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(paymentResponse)));

    vi.stubGlobal("fetch", fetchMock);

    await createYooKassaPayment({} as never, {
      orderId: 42,
      amount: new Prisma.Decimal("341.00"),
      description: "Заказ №42"
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body));

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.yookassa.test/v3/payments",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotence-Key": "order-42-receipt-v1"
        })
      })
    );
    expect(body.receipt.customer.email).toBe("buyer@example.com");
    expect(body.receipt.items).toHaveLength(2);
    expect(body.receipt.items[0]).toMatchObject({
      description: "Фильтр гидравлический (PT-100)",
      quantity: 2,
      amount: {
        value: "125.50",
        currency: "RUB"
      }
    });
  });
});
