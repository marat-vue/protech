import { describe, expect, it } from "vitest";
import { collectionInputSchema } from "../shared/schemas/admin/collections/upsertCollection";
import { categoryOrderSchema } from "../shared/schemas/admin/products/category";

function createCollectionInput(productIds: number[]) {
  return {
    title: "Сезонное обслуживание",
    description: "Подборка для подготовки автомобиля к сезону",
    image: "/uploads/season.webp",
    isActive: true,
    sortOrder: 0,
    productIds
  };
}

describe("catalog admin schemas", () => {
  it("allows a product collection to be saved without products", () => {
    const result = collectionInputSchema.safeParse(createCollectionInput([]));

    expect(result.success).toBe(true);
  });

  it("still rejects duplicate products in a collection", () => {
    const result = collectionInputSchema.safeParse(createCollectionInput([1, 1]));

    expect(result.success).toBe(false);
  });

  it("accepts a unique category display order", () => {
    const result = categoryOrderSchema.safeParse({ categoryIds: [3, 1, 2] });

    expect(result.success).toBe(true);
  });

  it("rejects duplicate categories in the display order", () => {
    const result = categoryOrderSchema.safeParse({ categoryIds: [1, 2, 1] });

    expect(result.success).toBe(false);
  });
});
