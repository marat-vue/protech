-- CreateTable
CREATE TABLE "product_collection" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_collection_item" (
    "id" SERIAL NOT NULL,
    "collection_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_collection_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_collection_is_active_sort_order_idx" ON "product_collection"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "product_collection_item_collection_id_sort_order_idx" ON "product_collection_item"("collection_id", "sort_order");

-- CreateIndex
CREATE INDEX "product_collection_item_product_id_idx" ON "product_collection_item"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_collection_item_collection_id_product_id_key" ON "product_collection_item"("collection_id", "product_id");

-- AddForeignKey
ALTER TABLE "product_collection_item" ADD CONSTRAINT "product_collection_item_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "product_collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_collection_item" ADD CONSTRAINT "product_collection_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
