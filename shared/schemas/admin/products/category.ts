import z from "zod";

export const categorySchema = z.strictObject({
	name: z
		.string('Название категории необходимо')
		.trim()
		.max(50, 'Название категории не более 50 символов')
		.min(1, "Название категории необходимо")
})

export const categoryOrderSchema = z.strictObject({
	categoryIds: z
		.array(
			z.coerce
				.number("ID категории должен быть числом")
				.int("ID категории должен быть целым числом")
				.positive("ID категории должен быть больше нуля")
		)
		.min(1, "Передайте хотя бы одну категорию")
		.max(1000, "Нельзя упорядочить больше 1000 категорий за один раз")
		.refine((ids) => new Set(ids).size === ids.length, "Категории не должны повторяться")
})

export type CategoryInput = z.infer<typeof categorySchema>
export type CategoryOrderInput = z.infer<typeof categoryOrderSchema>
