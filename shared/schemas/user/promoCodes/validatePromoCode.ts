import { z } from "zod";
import { orderItemsSchema } from "../orders/createOrder";
import { promoCodeSchema } from "../../promoCodes/code";

export const validatePromoCodeSchema = z.strictObject({
  code: promoCodeSchema,
  orderItems: orderItemsSchema
});
