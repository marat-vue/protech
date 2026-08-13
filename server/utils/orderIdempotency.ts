import { createHash } from "node:crypto";
import { createError, getHeader, type H3Event } from "h3";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

export function createOrderRequestFingerprint(value: unknown) {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex");
}

export function assertOrderIdempotencyKey(key: string | undefined) {
  const normalized = key?.trim();

  if (!normalized || !IDEMPOTENCY_KEY_PATTERN.test(normalized)) {
    throw createError({
      statusCode: 400,
      message: "Для создания заказа необходим корректный Idempotency-Key"
    });
  }

  return normalized;
}

export function getOrderIdempotencyKey(event: H3Event) {
  return assertOrderIdempotencyKey(getHeader(event, "idempotency-key"));
}
