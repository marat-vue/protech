import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();

describe("public product collections", () => {
  beforeEach(() => {
    findMany.mockReset();
    vi.stubGlobal("prisma", {
      productCollection: {
        findMany
      }
    });
    vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("returns active collections even when they have no active products", async () => {
    findMany.mockResolvedValue([
      {
        id: 7,
        title: "Скоро в продаже",
        description: "Новая подборка",
        image: "/uploads/soon.webp",
        productCollectionItems: []
      }
    ]);

    const { default: handler } = await import("../server/api/public/collections/index.get");
    const result = await handler({} as never);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        isActive: true
      }
    }));
    expect(result).toEqual([
      {
        id: 7,
        title: "Скоро в продаже",
        description: "Новая подборка",
        image: "/uploads/soon.webp",
        productsCount: 0
      }
    ]);
  });
});
