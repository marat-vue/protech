import { z } from "zod";

export const callbackRequestPhoneSchema = z
  .string("Телефон необходим")
  .trim()
  .min(7, "Телефон должен содержать не менее 7 символов")
  .max(30, "Телефон должен быть не длиннее 30 символов")
  .regex(/^\+?[0-9\s().-]+$/, "Введите корректный номер телефона");

export const createCallbackRequestSchema = z.strictObject({
  name: z
    .string("Имя необходимо")
    .trim()
    .min(2, "Имя должно содержать не менее 2 символов")
    .max(120, "Имя должно быть не длиннее 120 символов"),
  phone: callbackRequestPhoneSchema,
  consentAccepted: z
    .boolean()
    .refine((value) => value, "Подтвердите согласие на обработку персональных данных"),
  sourcePath: z.string().trim().max(500).optional()
});

export type CreateCallbackRequestInput = z.infer<typeof createCallbackRequestSchema>;
