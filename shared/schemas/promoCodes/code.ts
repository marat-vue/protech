import { z } from "zod";

export function normalizePromoCode(value: string) {
  return value.trim().toUpperCase();
}

export const promoCodeSchema = z
  .string("Промокод должен быть строкой")
  .trim()
  .min(1, "Введите промокод")
  .max(64, "Промокод должен быть не длиннее 64 символов")
  .transform(normalizePromoCode)
  .refine(
    (value) => /^[A-ZА-ЯЁ0-9_-]+$/u.test(value),
    "Используйте только буквы, цифры, дефис или подчёркивание"
  );
