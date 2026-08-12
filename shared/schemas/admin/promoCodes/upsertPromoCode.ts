import { z } from "zod";
import { promoCodeSchema } from "../../promoCodes/code";

const expiresAtSchema = z
  .string()
  .datetime({ offset: true, message: "Некорректная дата окончания" })
  .nullable();

export const promoCodeInputSchema = z.strictObject({
  code: promoCodeSchema,
  discountPercent: z.coerce
    .number("Укажите скидку")
    .int("Скидка должна быть целым числом")
    .min(1, "Скидка должна быть не меньше 1%")
    .max(99, "Скидка должна быть не больше 99%"),
  isActive: z.boolean(),
  expiresAt: expiresAtSchema
});

export const updatePromoCodeInputSchema = promoCodeInputSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, "Передайте хотя бы одно поле для обновления");

export type PromoCodeInput = z.infer<typeof promoCodeInputSchema>;
