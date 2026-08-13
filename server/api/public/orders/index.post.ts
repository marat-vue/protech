import {
  OrderStatus,
  PaymentCreationStatus,
  PaymentStatus,
  Prisma
} from "@prisma/client";
import { createOrderRequestFingerprint, getOrderIdempotencyKey } from "~~/server/utils/orderIdempotency";
import { reserveProductStock } from "~~/server/utils/orderStock";
import { ensureOzonPayCheckout } from "~~/server/utils/ozonPayCheckout";
import { assertPromoCodeIsAvailable, calculatePromoPricing } from "~~/server/utils/promoCode";
import { createOrderSchema } from "~~/shared/schemas/user/orders/createOrder";

export default defineEventHandler(async (event) => {
  const { user } = await requireUser(event);
  const body = await validateBody(event, createOrderSchema);
  const idempotencyKey = getOrderIdempotencyKey(event);
  const requestFingerprint = createOrderRequestFingerprint(body);

  const existingOrder = await prisma.order.findUnique({
    where: { idempotencyKey },
    select: {
      id: true,
      userId: true,
      requestFingerprint: true,
      paymentMethod: true
    }
  });

  if (existingOrder) {
    if (
      existingOrder.userId !== user.id ||
      existingOrder.requestFingerprint !== requestFingerprint
    ) {
      throw createError({
        statusCode: 409,
        message: "Idempotency-Key уже использован для другого заказа"
      });
    }

    return buildCreateOrderResponse(event, existingOrder.id, existingOrder.paymentMethod);
  }

  const orderId = await prisma.$transaction(async (tx) => {
    const productIds = body.orderItems.map((item) => item.productId);

    const products = await tx.product.findMany({
      where: {
        id: {
          in: productIds
        }
      },
      select: {
        id: true,
        name: true,
        article: true,
        mainImage: true,
        currentPrice: true,
        costPrice: true,
        isActive: true,
        category: {
          select: {
            id: true,
            name: true
          }
        },
        productStocks: {
          select: { quantity: true }
        }
      }
    });

    if (products.length !== productIds.length) {
      throw createError({
        statusCode: 400,
        message: "Один или несколько товаров не найдены"
      });
    }

    for (const product of products) {
      if (!product.isActive) {
        throw createError({
          statusCode: 400,
          message: `Товар с ID ${product.id} недоступен для заказа`
        });
      }
    }

    for (const item of body.orderItems) {
      const product = products.find((candidate) => candidate.id === item.productId);
      const stock = product?.productStocks[0]?.quantity ?? 0;

      if (stock < item.quantity) {
        throw createError({
          statusCode: 400,
          message: `Недостаточно товара с ID ${item.productId} на складе`
        });
      }
    }

    const productById = new Map(products.map((product) => [product.id, product]));
    const priceByProductId = new Map<number, Prisma.Decimal>(
      products.map((product) => [
        product.id,
        new Prisma.Decimal(product.currentPrice)
      ])
    );

    const getProductPrice = (productId: number): Prisma.Decimal => {
      const price = priceByProductId.get(productId);

      if (!price) {
        throw createError({
          statusCode: 400,
          message: `Товар с ID ${productId} не найден`
        });
      }

      return price;
    };

    const subtotalAmount = body.orderItems.reduce<Prisma.Decimal>((sum, item) => {
      const price = getProductPrice(item.productId);

      return sum.add(price.mul(item.quantity));
    }, new Prisma.Decimal(0));

    if (subtotalAmount.lte(0)) {
      throw createError({
        statusCode: 400,
        message: "Сумма заказа должна быть больше нуля"
      });
    }

    const promoCode = body.promoCode
      ? await tx.promoCode.findUnique({
          where: { code: body.promoCode },
          select: {
            id: true,
            code: true,
            discountPercent: true,
            isActive: true,
            expiresAt: true
          }
        })
      : null;

    if (body.promoCode) {
      assertPromoCodeIsAvailable(promoCode);
    }

    const pricing = calculatePromoPricing(
      subtotalAmount,
      promoCode?.discountPercent ?? 0,
      body.orderItems.reduce((sum, item) => sum + item.quantity, 0)
    );

    const createdOrder = await tx.order.create({
      data: {
        userId: user.id,
        obtainingMethod: body.obtainingMethod,
        paymentMethod: body.paymentMethod,
        customerPhone: body.customerPhone,
        recipientName: body.recipient?.name,
        recipientPhone: body.recipient?.phone,
        stockReserved: true,
        idempotencyKey,
        requestFingerprint,
        promoCodeId: promoCode?.id,
        promoCodeText: promoCode?.code,
        promoDiscountPercent: promoCode?.discountPercent ?? 0,
        subtotalAmount: pricing.subtotal,
        discountAmount: pricing.discountAmount,

        orderStatus:
          body.paymentMethod === "ONLINE"
            ? OrderStatus.NEW
            : OrderStatus.CONFIRMED
      }
    });

    await tx.orderItem.createMany({
      data: body.orderItems.map((item) => {
        const product = productById.get(item.productId)!;
        const price = priceByProductId.get(item.productId)!;

        return {
          orderId: createdOrder.id,
          productId: item.productId,
          quantity: item.quantity,
          price,
          costPrice: product.costPrice,
          lineTotal: price.mul(item.quantity),
          productName: product.name,
          productArticle: product.article,
          productMainImage: product.mainImage,
          categoryId: product.category.id,
          categoryName: product.category.name
        };
      })
    });

    if (body.obtainingMethod === "DELIVERY") {
      await tx.delivery.create({
        data: {
          orderId: createdOrder.id,
          address: body.delivery.address,
          apartment: body.delivery.apartment,
          entrance: body.delivery.entrance,
          floor: body.delivery.floor,
          intercom: body.delivery.intercom,
          comment: body.delivery.comment,
          deliveryMethod: body.delivery.deliveryMethod
        }
      });
    }

    await tx.payment.create({
      data: {
        orderId: createdOrder.id,
        paymentStatus:
          body.paymentMethod === "ONLINE"
            ? PaymentStatus.PENDING
            : PaymentStatus.UPON_RECEIPT,
        creationStatus:
          body.paymentMethod === "ONLINE"
            ? PaymentCreationStatus.NOT_STARTED
            : PaymentCreationStatus.NOT_REQUIRED,

        amount: pricing.totalAmount
      }
    });

    await reserveProductStock(tx, body.orderItems, {
      orderId: createdOrder.id,
      reason: "Order created"
    });

    return createdOrder.id;
  }).catch(async (error) => {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const duplicate = await prisma.order.findUnique({
        where: { idempotencyKey },
        select: {
          id: true,
          userId: true,
          requestFingerprint: true
        }
      });

      if (
        duplicate?.userId === user.id &&
        duplicate.requestFingerprint === requestFingerprint
      ) {
        return duplicate.id;
      }
    }

    const prismaError = toPrismaHttpError(error, {
      P2003: "Один или несколько товаров не найдены"
    });

    if (prismaError) {
      throw prismaError;
    }

    throw error;
  });

  return buildCreateOrderResponse(event, orderId, body.paymentMethod);
});

async function buildCreateOrderResponse(
  event: Parameters<typeof ensureOzonPayCheckout>[0],
  orderId: number,
  paymentMethod: "OFFLINE" | "ONLINE"
) {
  if (paymentMethod === "OFFLINE") {
    return {
      order: {
        id: orderId
      },
      payment: {
        type: "offline",
        confirmationUrl: null
      }
    };
  }

  let checkout;

  try {
    checkout = await ensureOzonPayCheckout(event, orderId);
  } catch (error) {
    const payment = await prisma.payment.findUnique({
      where: { orderId },
      select: {
        creationStatus: true,
        providerStatus: true
      }
    });

    if (
      payment?.creationStatus === PaymentCreationStatus.CREATING ||
      payment?.creationStatus === PaymentCreationStatus.UNKNOWN
    ) {
      checkout = {
        status: payment.providerStatus ?? payment.creationStatus,
        confirmationUrl: null
      };
    } else {
      throw error;
    }
  }

  return {
    order: {
      id: orderId
    },
    payment: {
      type: "ozon",
      status: checkout.status,
      confirmationUrl: checkout.confirmationUrl
    }
  };
}
