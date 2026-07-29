import { z } from "zod";

export const callbackRequestStatuses = [
  "NEW",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED"
] as const;

export const updateCallbackRequestSchema = z.strictObject({
  status: z.enum(callbackRequestStatuses),
  adminNote: z.string().trim().max(2000, "Заметка должна быть не длиннее 2000 символов").optional()
});

export type UpdateCallbackRequestInput = z.infer<typeof updateCallbackRequestSchema>;
