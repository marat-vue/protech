-- Add a stable storefront display order for product categories.
ALTER TABLE "category" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

WITH "ranked_categories" AS (
    SELECT
        "id",
        (ROW_NUMBER() OVER (ORDER BY "name" ASC, "id" ASC) - 1)::INTEGER AS "position"
    FROM "category"
)
UPDATE "category"
SET "sort_order" = "ranked_categories"."position"
FROM "ranked_categories"
WHERE "category"."id" = "ranked_categories"."id";

CREATE INDEX "category_sort_order_id_idx" ON "category"("sort_order", "id");
