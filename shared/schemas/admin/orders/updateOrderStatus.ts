import z from "zod";

export const updateOrderStatusSchema = z.strictObject({
	orderStatus: z
		.enum(
			["NEW", "CONFIRMED", "PROCESSING", "SHIPPED", "COMPLETED", "PAYMENT_REVIEW", "CANCELLED"],
			"Статус заказа необходим"
		),
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
