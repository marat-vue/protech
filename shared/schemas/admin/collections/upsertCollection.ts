import z from "zod";
import { imagePathSchema } from "../../imagePath";

const productIdsSchema = z
  .array(
    z
      .coerce
      .number("ID товара должен быть числом")
      .int("ID товара должен быть целым числом")
      .positive("ID товара должен быть больше нуля")
  )
  .max(100, "В одной рубрике должно быть не более 100 товаров")
  .refine((ids) => new Set(ids).size === ids.length, "Товары в рубрике не должны повторяться");

export const collectionInputSchema = z.strictObject({
  title: z
    .string("Название рубрики необходимо")
    .trim()
    .min(1, "Название рубрики необходимо")
    .max(120, "Название должно быть не более 120 символов"),

  description: z
    .string("Описание рубрики необходимо")
    .trim()
    .min(1, "Описание рубрики необходимо")
    .max(500, "Описание должно быть не более 500 символов"),

  image: imagePathSchema,

  isActive: z.boolean(),

  sortOrder: z
    .coerce
    .number()
    .int("Порядок должен быть целым числом")
    .min(0, "Порядок не может быть отрицательным")
    .max(9999, "Порядок должен быть не больше 9999"),

  productIds: productIdsSchema
});

export const updateCollectionInputSchema = collectionInputSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  "Передайте хотя бы одно поле для обновления"
);

export type CollectionInput = z.infer<typeof collectionInputSchema>;
export type UpdateCollectionInput = z.infer<typeof updateCollectionInputSchema>;
