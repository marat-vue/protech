import { describe, expect, it } from "vitest";
import { calculatePromoPricing } from "../server/utils/promoCode";
import { promoCodeInputSchema } from "../shared/schemas/admin/promoCodes/upsertPromoCode";

describe("promo code pricing", () => {
  it("rounds a percentage discount to kopecks", () => {
    const pricing = calculatePromoPricing("999.99", 15, 3);

    expect(pricing.subtotal.toFixed(2)).toBe("999.99");
    expect(pricing.discountAmount.toFixed(2)).toBe("150.00");
    expect(pricing.totalAmount.toFixed(2)).toBe("849.99");
  });

  it("keeps at least one kopeck payable per product unit", () => {
    const pricing = calculatePromoPricing("1.00", 99, 3);

    expect(pricing.discountAmount.toFixed(2)).toBe("0.97");
    expect(pricing.totalAmount.toFixed(2)).toBe("0.03");
  });
});

describe("promo code input", () => {
  it("normalizes codes and accepts an optional expiry", () => {
    const result = promoCodeInputSchema.safeParse({
      code: " summer-15 ",
      discountPercent: 15,
      isActive: true,
      expiresAt: null
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.code).toBe("SUMMER-15");
  });

  it("rejects unsafe characters and discounts outside 1-99%", () => {
    expect(promoCodeInputSchema.safeParse({
      code: "SAVE 15!",
      discountPercent: 100,
      isActive: true,
      expiresAt: null
    }).success).toBe(false);
  });
});
