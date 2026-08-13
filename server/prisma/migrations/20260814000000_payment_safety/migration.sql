ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_REVIEW';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_REFUNDED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';

CREATE TYPE "PaymentCreationStatus" AS ENUM (
    'NOT_REQUIRED',
    'NOT_STARTED',
    'CREATING',
    'READY',
    'UNKNOWN',
    'FAILED'
);

ALTER TABLE "order"
    ADD COLUMN "idempotency_key" VARCHAR(128),
    ADD COLUMN "request_fingerprint" VARCHAR(64);

ALTER TABLE "payment"
    ADD COLUMN "creation_status" "PaymentCreationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    ADD COLUMN "refunded_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN "provider_status" TEXT,
    ADD COLUMN "creation_started_at" TIMESTAMP(3),
    ADD COLUMN "refunded_at" TIMESTAMP(3),
    ADD COLUMN "last_error" TEXT;

UPDATE "payment" p
SET "creation_status" = CASE
    WHEN o."payment_method" = 'OFFLINE' THEN 'NOT_REQUIRED'::"PaymentCreationStatus"
    WHEN p."transaction_id" IS NOT NULL OR p."confirmation_url" IS NOT NULL THEN 'READY'::"PaymentCreationStatus"
    WHEN p."payment_status" = 'CANCELLED' THEN 'FAILED'::"PaymentCreationStatus"
    ELSE 'NOT_STARTED'::"PaymentCreationStatus"
END
FROM "order" o
WHERE o."id" = p."order_id";

CREATE UNIQUE INDEX "order_idempotency_key_key" ON "order"("idempotency_key");
