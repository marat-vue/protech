CREATE TABLE "promo_code" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "discount_percent" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promo_code_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "promo_code_discount_percent_check" CHECK ("discount_percent" BETWEEN 1 AND 99)
);

ALTER TABLE "order"
    ADD COLUMN "promo_code_id" INTEGER,
    ADD COLUMN "promo_code" VARCHAR(64),
    ADD COLUMN "promo_discount_percent" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "subtotal_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE "order"
SET "subtotal_amount" = COALESCE(
    (SELECT "amount" FROM "payment" WHERE "payment"."order_id" = "order"."id"),
    0
);

CREATE UNIQUE INDEX "promo_code_code_key" ON "promo_code"("code");
CREATE INDEX "promo_code_is_active_expires_at_idx" ON "promo_code"("is_active", "expires_at");
CREATE INDEX "order_promo_code_id_idx" ON "order"("promo_code_id");

ALTER TABLE "order"
    ADD CONSTRAINT "order_promo_code_id_fkey"
    FOREIGN KEY ("promo_code_id") REFERENCES "promo_code"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
