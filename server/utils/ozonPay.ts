import { createHash, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { createError, type H3Event } from "h3";
import { getPositiveIntegerEnv } from "./env";
import { prisma } from "./prisma";

export const OZON_PAY_TRANSACTION_PREFIX = "ozon:";
export const OZON_PAY_CURRENCY_CODE = "643";

const OZON_PAY_VAT_VALUES = [
  "VAT_0",
  "VAT_5",
  "VAT_7",
  "VAT_10",
  "VAT_22",
  "VAT_10_110",
  "VAT_22_122",
  "VAT_NONE",
  "VAT_18",
  "VAT_18_118",
  "VAT_5_105",
  "VAT_7_107"
] as const;

type OzonPayVat = typeof OZON_PAY_VAT_VALUES[number];

type OzonPayMoney = {
  currencyCode: typeof OZON_PAY_CURRENCY_CODE;
  value: string;
};

type OzonPayReceiptSourceItem = {
  id: number;
  productId: number;
  productName: string;
  productArticle: string;
  quantity: number;
  price: Prisma.Decimal;
};

export type OzonPayOrderStatus =
  | "STATUS_NEW"
  | "STATUS_PAYMENT_PENDING"
  | "STATUS_PAID"
  | "STATUS_PARTITIONAL_REFUND"
  | "STATUS_AUTHORIZED"
  | "STATUS_CANCELED"
  | "STATUS_DISPUTED"
  | "STATUS_EXPIRED"
  | "STATUS_REFUNDED"
  | "STATUS_PARTITION_CANCELED"
  | "STATUS_DISPUTING";

export type OzonPayOrder = {
  id: string;
  extId: string;
  payLink: string;
  status: OzonPayOrderStatus;
  isTestMode: boolean;
  originalAmount?: OzonPayMoney;
  remainingAmount?: OzonPayMoney;
};

export type OzonPayNotificationSignatureInput = {
  orderID?: string | null;
  transactionID?: string | number | null;
  extOrderID?: string | null;
  amount: string | number;
  currencyCode: string;
};

type OzonPayCreateOrderResponse = {
  order: OzonPayOrder;
  extData?: Record<string, string> | null;
};

type OzonPayOrderStatusResponse = {
  id: string;
  extId: string;
  status: OzonPayOrderStatus;
  isTestMode: boolean;
  originalAmount: OzonPayMoney;
  remainingAmount: OzonPayMoney;
};

type OzonPayConfig = {
  accessKey: string;
  secretKey: string;
  notificationSecretKey: string;
  apiUrl: string;
  appUrl: string;
  vat: OzonPayVat;
  enableFiscalization?: boolean;
};

export function encodeOzonPayOrderId(orderId: string) {
  return `${OZON_PAY_TRANSACTION_PREFIX}${orderId}`;
}

export function decodeOzonPayOrderId(transactionId: string) {
  return transactionId.startsWith(OZON_PAY_TRANSACTION_PREFIX)
    ? transactionId.slice(OZON_PAY_TRANSACTION_PREFIX.length)
    : null;
}

export function createOzonPayHash(parts: Array<string | number | null | undefined>) {
  return createHash("sha256")
    .update(parts.map((part) => part ?? "").join(""), "utf8")
    .digest("hex");
}

export function createOzonPayNotificationSignature(
  accessKey: string,
  notificationSecretKey: string,
  input: OzonPayNotificationSignatureInput
) {
  return createHash("sha256")
    .update([
      accessKey,
      input.orderID ?? "",
      input.transactionID ?? "",
      input.extOrderID ?? "",
      input.amount,
      input.currencyCode,
      notificationSecretKey
    ].join("|"), "utf8")
    .digest("hex");
}

export function verifyOzonPayNotificationSignature(
  accessKey: string,
  notificationSecretKey: string,
  input: OzonPayNotificationSignatureInput,
  requestSign: string
) {
  if (!/^[a-f\d]{64}$/i.test(requestSign)) {
    return false;
  }

  const expected = createOzonPayNotificationSignature(
    accessKey,
    notificationSecretKey,
    input
  );

  return timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(requestSign, "hex")
  );
}

export function toOzonPayMinorUnits(value: Prisma.Decimal.Value) {
  const minorUnits = new Prisma.Decimal(value).mul(100);

  if (!minorUnits.isInteger() || minorUnits.lte(0)) {
    throw createError({
      statusCode: 500,
      message: "Сумма Ozon Pay должна быть положительной и указана с точностью до копейки"
    });
  }

  return minorUnits.toFixed(0);
}

function getOptionalBoolean(value: unknown, name: string) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") return true;
  if (value === "false") return false;

  throw createError({
    statusCode: 500,
    message: `${name} должен быть true или false`
  });
}

function getOzonPayConfig(event?: H3Event): OzonPayConfig {
  const config = useRuntimeConfig(event);
  const accessKey = String(config.ozonPayAccessKey || "").trim();
  const secretKey = String(config.ozonPaySecretKey || "").trim();
  const notificationSecretKey = String(config.ozonPayNotificationSecretKey || "").trim();
  const apiUrl = String(config.ozonPayApiUrl || "https://payapi.ozon.ru").replace(/\/$/, "");
  const appUrl = String(config.public.appUrl || "").replace(/\/$/, "");
  const rawVat = String(config.ozonPayVat || "VAT_NONE").trim();

  if (!accessKey || !secretKey) {
    throw createError({
      statusCode: 500,
      message: "Не настроены OZON_PAY_ACCESS_KEY / OZON_PAY_SECRET_KEY"
    });
  }

  if (!appUrl) {
    throw createError({
      statusCode: 500,
      message: "Не настроен NUXT_PUBLIC_APP_URL"
    });
  }

  if (!OZON_PAY_VAT_VALUES.includes(rawVat as OzonPayVat)) {
    throw createError({
      statusCode: 500,
      message: `OZON_PAY_VAT должен быть одним из: ${OZON_PAY_VAT_VALUES.join(", ")}`
    });
  }

  return {
    accessKey,
    secretKey,
    notificationSecretKey,
    apiUrl,
    appUrl,
    vat: rawVat as OzonPayVat,
    enableFiscalization: getOptionalBoolean(
      config.ozonPayEnableFiscalization,
      "OZON_PAY_ENABLE_FISCALIZATION"
    )
  };
}

export function getOzonPayNotificationCredentials(event: H3Event) {
  const config = getOzonPayConfig(event);

  if (!config.notificationSecretKey) {
    throw createError({
      statusCode: 500,
      message: "Не настроен OZON_PAY_NOTIFICATION_SECRET_KEY"
    });
  }

  return {
    accessKey: config.accessKey,
    notificationSecretKey: config.notificationSecretKey
  };
}

function truncateItemName(value: string, fallback: string) {
  const normalized = value.replace(/\s+/g, " ").trim() || fallback;

  return Array.from(normalized).slice(0, 128).join("");
}

export function allocateOzonPayReceiptItems(
  orderItems: OzonPayReceiptSourceItem[],
  paymentAmount: Prisma.Decimal.Value
) {
  const bigintZero = BigInt(0);
  const bigintOne = BigInt(1);
  const sourceItems = orderItems.map((item) => {
    const priceMinor = BigInt(toOzonPayMinorUnits(item.price));
    const originalLineMinor = priceMinor * BigInt(item.quantity);

    return {
      item,
      originalLineMinor,
      reducibleMinor: originalLineMinor - BigInt(item.quantity)
    };
  });
  const originalTotalMinor = sourceItems.reduce((sum, item) => sum + item.originalLineMinor, bigintZero);
  const paymentTotalMinor = BigInt(toOzonPayMinorUnits(paymentAmount));
  const discountMinor = originalTotalMinor - paymentTotalMinor;
  const totalReducibleMinor = sourceItems.reduce((sum, item) => sum + item.reducibleMinor, bigintZero);

  if (discountMinor < bigintZero || discountMinor > totalReducibleMinor) {
    throw createError({
      statusCode: 500,
      message: "Сумма позиций Ozon Pay не совпадает с суммой платежа"
    });
  }

  const allocations = sourceItems.map((source, index) => {
    if (!discountMinor || !totalReducibleMinor) {
      return { index, discount: bigintZero, remainder: bigintZero };
    }

    const exactNumerator = discountMinor * source.reducibleMinor;
    const discount = exactNumerator / totalReducibleMinor;

    return {
      index,
      discount,
      remainder: exactNumerator % totalReducibleMinor
    };
  });
  let undistributed = discountMinor - allocations.reduce((sum, item) => sum + item.discount, bigintZero);

  for (const allocation of [...allocations].sort((left, right) => (
    left.remainder === right.remainder ? 0 : left.remainder > right.remainder ? -1 : 1
  ))) {
    if (!undistributed) break;
    const source = sourceItems[allocation.index]!;

    if (allocation.discount < source.reducibleMinor) {
      allocation.discount += bigintOne;
      undistributed -= bigintOne;
    }
  }

  if (undistributed) {
    throw createError({
      statusCode: 500,
      message: "Не удалось распределить скидку по позициям Ozon Pay"
    });
  }

  return sourceItems.flatMap((source, index) => {
    const allocatedDiscount = allocations[index]!.discount;
    const payableLineMinor = source.originalLineMinor - allocatedDiscount;
    const quantity = BigInt(source.item.quantity);
    const baseUnitMinor = payableLineMinor / quantity;
    const higherPriceQuantity = Number(payableLineMinor % quantity);
    const basePriceQuantity = source.item.quantity - higherPriceQuantity;
    const name = truncateItemName(
      `${source.item.productName} (${source.item.productArticle})`,
      `Товар ${source.item.productId}`
    );

    if (!allocatedDiscount || higherPriceQuantity === 0) {
      return [{
        ...source.item,
        extId: `order-item-${source.item.id}`,
        name,
        priceMinor: Number(baseUnitMinor),
        quantity: source.item.quantity
      }];
    }

    return [
      ...(higherPriceQuantity
        ? [{
            ...source.item,
            extId: `order-item-${source.item.id}-a`,
            name,
            priceMinor: Number(baseUnitMinor + bigintOne),
            quantity: higherPriceQuantity
          }]
        : []),
      ...(basePriceQuantity
        ? [{
            ...source.item,
            extId: `order-item-${source.item.id}-b`,
            name,
            priceMinor: Number(baseUnitMinor),
            quantity: basePriceQuantity
          }]
        : [])
    ];
  });
}

export async function buildOzonPayCreateOrderBody(
  event: H3Event,
  input: {
    orderId: number;
    amount: Prisma.Decimal;
    expiresAt: Date;
  }
) {
  const config = getOzonPayConfig(event);
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: {
      id: true,
      user: {
        select: { email: true }
      },
      orderItems: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          productId: true,
          productName: true,
          productArticle: true,
          quantity: true,
          price: true
        }
      }
    }
  });

  if (!order) {
    throw createError({
      statusCode: 404,
      message: "Заказ для оплаты через Ozon Pay не найден"
    });
  }

  if (!order.orderItems.length) {
    throw createError({
      statusCode: 500,
      message: "Заказ Ozon Pay не может быть пустым"
    });
  }

  const receiptEmail = order.user?.email.trim();

  if (!receiptEmail) {
    throw createError({
      statusCode: 500,
      message: "Для чека Ozon Pay нужен email покупателя"
    });
  }

  const receiptItems = allocateOzonPayReceiptItems(order.orderItems, input.amount);

  const extId = String(input.orderId);
  const expiresAt = input.expiresAt.toISOString();
  const fiscalizationType = "FISCAL_TYPE_SINGLE" as const;
  const paymentAlgorithm = "PAY_ALGO_SMS" as const;
  const amount: OzonPayMoney = {
    currencyCode: OZON_PAY_CURRENCY_CODE,
    value: toOzonPayMinorUnits(input.amount)
  };

  const requestSign = createOzonPayHash([
    config.accessKey,
    expiresAt,
    extId,
    fiscalizationType,
    paymentAlgorithm,
    amount.currencyCode,
    amount.value,
    config.secretKey
  ]);

  return {
    accessKey: config.accessKey,
    amount,
    expiresAt,
    extData: {
      orderId: extId
    },
    extId,
    failUrl: `${config.appUrl}/orders/${order.id}?payment=failed`,
    fiscalizationType,
    items: receiptItems.map((item) => ({
      extId: item.extId,
      name: item.name,
      needMark: false,
      price: {
        currencyCode: OZON_PAY_CURRENCY_CODE,
        value: String(item.priceMinor)
      },
      quantity: item.quantity,
      type: "TYPE_PRODUCT" as const,
      vat: config.vat
    })),
    mode: "MODE_FULL" as const,
    notificationUrl: `${config.appUrl}/api/public/payments/ozon/webhook`,
    paymentAlgorithm,
    receiptEmail,
    requestSign,
    successUrl: `${config.appUrl}/orders/${order.id}?payment=success`,
    ...(config.enableFiscalization === undefined
      ? {}
      : { enableFiscalization: config.enableFiscalization })
  };
}

async function fetchOzonPay(event: H3Event | undefined, path: string, body: object) {
  const config = getOzonPayConfig(event);
  const timeoutMs = getPositiveIntegerEnv("OZON_PAY_TIMEOUT_MS", 10_000, {
    min: 1_000,
    max: 60_000
  });
  const url = `${config.apiUrl}${path}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs)
    });

    if (!response.ok) {
      const responseBody = await response.text();

      console.error("[Ozon Pay] Ошибка ответа", {
        path,
        status: response.status,
        statusText: response.statusText
      });

      throw createError({
        statusCode: 502,
        message: "Ozon Pay не выполнил запрос",
        data: {
          status: response.status,
          body: responseBody
        }
      });
    }

    return response;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      throw createError({
        statusCode: 504,
        message: "Ozon Pay не ответил вовремя"
      });
    }

    throw error;
  }
}

export async function createOzonPayOrder(
  event: H3Event,
  input: {
    orderId: number;
    amount: Prisma.Decimal;
    expiresAt: Date;
  }
) {
  const body = await buildOzonPayCreateOrderBody(event, input);
  const response = await fetchOzonPay(event, "/v1/createOrder", body);
  const result = (await response.json()) as OzonPayCreateOrderResponse;

  if (!result.order?.id || !result.order.payLink) {
    throw createError({
      statusCode: 502,
      message: "Ozon Pay не вернул ссылку на оплату"
    });
  }

  return result.order;
}

export async function getOzonPayOrderStatus(event: H3Event | undefined, orderId: string) {
  const config = getOzonPayConfig(event);
  const requestSign = createOzonPayHash([
    orderId,
    "",
    config.accessKey,
    config.secretKey
  ]);
  const response = await fetchOzonPay(event, "/v1/getOrderStatus", {
    accessKey: config.accessKey,
    id: orderId,
    requestSign
  });

  return (await response.json()) as OzonPayOrderStatusResponse;
}
