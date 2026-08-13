import {
  AuditAction,
  type OrderStatus,
  type PaymentStatus,
  type Prisma
} from "@prisma/client";

type AuditClient = Pick<Prisma.TransactionClient, "auditLog">;

export async function createProviderPaymentAudit(
  db: AuditClient,
  input: {
    paymentId: number;
    orderId: number;
    provider: string;
    providerStatus: string;
    previousPaymentStatus: PaymentStatus;
    nextPaymentStatus: PaymentStatus;
    previousOrderStatus: OrderStatus;
    nextOrderStatus: OrderStatus;
  }
) {
  await db.auditLog.create({
    data: {
      action: AuditAction.PAYMENT_STATUS,
      entityType: "payment",
      entityId: String(input.paymentId),
      summary: `${input.provider} updated payment for order ${input.orderId}`,
      metadata: {
        orderId: input.orderId,
        provider: input.provider,
        providerStatus: input.providerStatus,
        previousPaymentStatus: input.previousPaymentStatus,
        paymentStatus: input.nextPaymentStatus
      }
    }
  });

  if (input.previousOrderStatus !== input.nextOrderStatus) {
    await db.auditLog.create({
      data: {
        action: AuditAction.ORDER_STATUS,
        entityType: "order",
        entityId: String(input.orderId),
        summary: `${input.provider} updated order ${input.orderId} status`,
        metadata: {
          provider: input.provider,
          providerStatus: input.providerStatus,
          previousOrderStatus: input.previousOrderStatus,
          orderStatus: input.nextOrderStatus
        }
      }
    });
  }
}
