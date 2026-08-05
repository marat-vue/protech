import { Buffer } from "node:buffer";
import { createError, type H3Event } from "h3";
import { Prisma } from "@prisma/client";
import { getPositiveIntegerEnv } from "./env";
import { prisma } from "./prisma";

export type YooKassaPayment = {
  id: string;
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled";
  paid: boolean;
  amount: {
    value: string;
    currency: string;
  };
  confirmation?: {
    type: string;
    confirmation_url?: string;
  };
  metadata?: Record<string, string>;
  receipt_registration?: "pending" | "succeeded" | "canceled";
};

const RECEIPT_MAX_ITEMS = 80;
const RECEIPT_DESCRIPTION_MAX_LENGTH = 128;
const DEFAULT_RECEIPT_VAT_CODE = 1;
const DEFAULT_RECEIPT_PAYMENT_MODE = "full_prepayment";
const DEFAULT_RECEIPT_PAYMENT_SUBJECT = "commodity";
const PAYMENT_IDEMPOTENCE_VERSION = "receipt-v1";
const YOOKASSA_RECEIPT_PAYMENT_MODES = [
  "full_prepayment",
  "full_payment"
] as const;

type YooKassaReceiptPaymentMode = typeof YOOKASSA_RECEIPT_PAYMENT_MODES[number];

type YooKassaReceiptItem = {
  description: string;
  quantity: number;
  amount: {
    value: string;
    currency: "RUB";
  };
  vat_code: number;
  payment_mode: YooKassaReceiptPaymentMode;
  payment_subject: string;
  measure: "piece";
};

type YooKassaReceipt = {
  customer: {
    email: string;
  };
  items: YooKassaReceiptItem[];
  internet: "true";
  tax_system_code?: number;
};

function getYooKassaAuth(event: H3Event) {
  const config = useRuntimeConfig(event);

  const shopId = config.yookassaShopId;
  const secretKey = config.yookassaSecretKey;

  if (!shopId || !secretKey) {
    throw createError({
      statusCode: 500,
      message: "Не настроены YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY"
    });
  }

  return `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString("base64")}`;
}

function getOptionalIntegerEnv(name: string, min: number, max: number) {
  const rawValue = process.env[name]?.trim();

  if (!rawValue) {
    return undefined;
  }

  const value = Number(rawValue);

  if (Number.isInteger(value) && value >= min && value <= max) {
    return value;
  }

  throw createError({
    statusCode: 500,
    message: `${name} должен быть целым числом от ${min} до ${max}`
  });
}

function getYooKassaReceiptVatCode() {
  return (
    getOptionalIntegerEnv("YOOKASSA_RECEIPT_VAT_CODE", 1, 12) ??
    DEFAULT_RECEIPT_VAT_CODE
  );
}

function getYooKassaReceiptTaxSystemCode() {
  return getOptionalIntegerEnv("YOOKASSA_RECEIPT_TAX_SYSTEM_CODE", 1, 6);
}

function getYooKassaReceiptPaymentMode(): YooKassaReceiptPaymentMode {
  const rawValue = process.env.YOOKASSA_RECEIPT_PAYMENT_MODE?.trim();

  if (!rawValue) {
    return DEFAULT_RECEIPT_PAYMENT_MODE;
  }

  if (YOOKASSA_RECEIPT_PAYMENT_MODES.includes(rawValue as YooKassaReceiptPaymentMode)) {
    return rawValue as YooKassaReceiptPaymentMode;
  }

  throw createError({
    statusCode: 500,
    message: `YOOKASSA_RECEIPT_PAYMENT_MODE должен быть одним из: ${YOOKASSA_RECEIPT_PAYMENT_MODES.join(", ")}`
  });
}

function getYooKassaReceiptPaymentSubject() {
  return process.env.YOOKASSA_RECEIPT_PAYMENT_SUBJECT?.trim() || DEFAULT_RECEIPT_PAYMENT_SUBJECT;
}

function truncateReceiptDescription(value: string, fallback: string) {
  const normalized = value.replace(/\s+/g, " ").trim() || fallback;

  return Array.from(normalized).slice(0, RECEIPT_DESCRIPTION_MAX_LENGTH).join("");
}

function formatYooKassaAmount(amount: Prisma.Decimal.Value) {
  const decimal = new Prisma.Decimal(amount);

  if (decimal.lte(0)) {
    throw createError({
      statusCode: 500,
      message: "Суммы в чеке ЮKassa должны быть положительными"
    });
  }

  return decimal.toFixed(2);
}

export async function buildYooKassaReceipt(orderId: number): Promise<YooKassaReceipt> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      user: {
        select: {
          email: true
        }
      },
      orderItems: {
        orderBy: {
          id: "asc"
        },
        select: {
          id: true,
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
      message: "Заказ для оплаты через ЮKassa не найден"
    });
  }

  const customerEmail = order.user?.email.trim();

  if (!customerEmail) {
    throw createError({
      statusCode: 500,
      message: "Для чека ЮKassa нужен email покупателя"
    });
  }

  if (order.orderItems.length === 0) {
    throw createError({
      statusCode: 500,
      message: "Чек ЮKassa не может быть пустым"
    });
  }

  if (order.orderItems.length > RECEIPT_MAX_ITEMS) {
    throw createError({
      statusCode: 500,
      message: `В чеке ЮKassa не может быть больше ${RECEIPT_MAX_ITEMS} позиций`
    });
  }

  const vatCode = getYooKassaReceiptVatCode();
  const paymentMode = getYooKassaReceiptPaymentMode();
  const paymentSubject = getYooKassaReceiptPaymentSubject();
  const taxSystemCode = getYooKassaReceiptTaxSystemCode();

  return {
    customer: {
      email: customerEmail
    },
    items: order.orderItems.map((item) => ({
      description: truncateReceiptDescription(
        `${item.productName} (${item.productArticle})`,
        `Позиция заказа ${item.id}`
      ),
      quantity: item.quantity,
      amount: {
        value: formatYooKassaAmount(item.price),
        currency: "RUB"
      },
      vat_code: vatCode,
      payment_mode: paymentMode,
      payment_subject: paymentSubject,
      measure: "piece"
    })),
    internet: "true",
    ...(taxSystemCode ? { tax_system_code: taxSystemCode } : {})
  };
}

export function getYooKassaReceiptTotal(receipt: Pick<YooKassaReceipt, "items">) {
  return receipt.items.reduce(
    (sum, item) => sum.add(new Prisma.Decimal(item.amount.value).mul(item.quantity)),
    new Prisma.Decimal(0)
  );
}

function getYooKassaApiUrl(event: H3Event) {
  const config = useRuntimeConfig(event);
  const url = String(config.yookassaApiUrl || "https://api.yookassa.ru");

  return url.replace(/\/$/, "");
}

async function fetchYooKassa(
  event: H3Event,
  path: string,
  init: RequestInit
) {
  const timeoutMs = getPositiveIntegerEnv("YOOKASSA_TIMEOUT_MS", 10_000, {
    min: 1_000,
    max: 60_000
  });

  const url = `${getYooKassaApiUrl(event)}${path}`;
  const method = init.method || "GET";

  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs)
    });

    const rawBody = await response.clone().text();

    let body: unknown = rawBody;

    if (rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        // Если ЮKassa вернула не JSON, выводим обычный текст.
      }
    } else {
      body = null;
    }

    const responseLog = {
      method,
      url,
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body
    };

    if (response.ok) {
      console.info("[YooKassa] Ответ получен:", responseLog);
    } else {
      console.error("[YooKassa] Ошибка ответа:", responseLog);
    }

    return response;
  } catch (error) {
    console.error("[YooKassa] Ошибка запроса:", {
      method,
      url,
      error
    });

    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      throw createError({
        statusCode: 504,
        message: "ЮKassa не ответила вовремя"
      });
    }

    throw error;
  }
}

function getYooKassaReturnUrl(event: H3Event, orderId: number) {
  const config = useRuntimeConfig(event);
  const appUrl = String(config.public.appUrl || "").replace(/\/$/, "");

  if (!appUrl) {
    throw createError({
      statusCode: 500,
      message: "Не настроен NUXT_PUBLIC_APP_URL"
    });
  }

  const configuredReturnUrl = String(config.yookassaReturnUrl || "").trim();

  if (!configuredReturnUrl) {
    return `${appUrl}/orders/${orderId}`;
  }

  if (configuredReturnUrl.includes("{orderId}")) {
    return configuredReturnUrl.replaceAll("{orderId}", String(orderId));
  }

  const returnUrl = new URL(configuredReturnUrl, `${appUrl}/`);

  if (returnUrl.pathname === "/" || returnUrl.pathname === "") {
    returnUrl.pathname = `/orders/${orderId}`;
    return returnUrl.toString();
  }

  if (!returnUrl.searchParams.has("orderId")) {
    returnUrl.searchParams.set("orderId", String(orderId));
  }

  return returnUrl.toString();
}

export async function createYooKassaPayment(
  event: H3Event,
  input: {
    orderId: number;
    amount: Prisma.Decimal;
    description: string;
  }
) {
  const config = useRuntimeConfig(event);

  if (!config.public.appUrl) {
    throw createError({
      statusCode: 500,
      message: "Не настроен NUXT_PUBLIC_APP_URL"
    });
  }

  const returnUrl = getYooKassaReturnUrl(event, input.orderId);
  const receipt = await buildYooKassaReceipt(input.orderId);
  const receiptTotal = getYooKassaReceiptTotal(receipt);

  if (!receiptTotal.equals(input.amount)) {
    throw createError({
      statusCode: 500,
      message: "Сумма чека ЮKassa не совпадает с суммой платежа"
    });
  }

  const response = await fetchYooKassa(event, "/v3/payments", {
    method: "POST",
    headers: {
      Authorization: getYooKassaAuth(event),
      "Content-Type": "application/json",

      "Idempotence-Key": `order-${input.orderId}-${PAYMENT_IDEMPOTENCE_VERSION}`
    },
    body: JSON.stringify({
      amount: {
        value: input.amount.toFixed(2),
        currency: "RUB"
      },
      capture: true,
      confirmation: {
        type: "redirect",
        return_url: returnUrl
      },
      description: input.description,
      metadata: {
        orderId: String(input.orderId)
      },
      receipt
    })
  });

  if (!response.ok) {
    throw createError({
      statusCode: 502,
      message: "ЮKassa не создала платеж",
      data: {
        status: response.status,
        body: await response.text()
      }
    });
  }

  return (await response.json()) as YooKassaPayment;
}

export async function getYooKassaPayment(event: H3Event, paymentId: string) {
  const response = await fetchYooKassa(event, `/v3/payments/${paymentId}`, {
    method: "GET",
    headers: {
      Authorization: getYooKassaAuth(event)
    }
  });

  if (!response.ok) {
    throw createError({
      statusCode: 502,
      message: "Не удалось проверить платеж в ЮKassa",
      data: {
        status: response.status,
        body: await response.text()
      }
    });
  }

  return (await response.json()) as YooKassaPayment;
}
