import type {
  CallbackRequestStatus,
  DeliveryMethod,
  MoneyLike,
  ObtainingMethod,
  OrderStatus,
  PaymentMethod,
  PaymentStatus
} from "~~/app/shared/types/admin";

export const callbackRequestStatusLabels: Record<CallbackRequestStatus, string> = {
  NEW: "Новая",
  IN_PROGRESS: "В работе",
  COMPLETED: "Завершена",
  CANCELLED: "Отменена"
};

export const callbackRequestStatusColor: Record<
  CallbackRequestStatus,
  "neutral" | "primary" | "warning" | "success" | "error" | "info"
> = {
  NEW: "info",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  CANCELLED: "neutral"
};

export const orderStatusLabels: Record<OrderStatus, string> = {
  NEW: "Новый",
  CONFIRMED: "Подтвержден",
  PROCESSING: "В работе",
  SHIPPED: "Отправлен",
  COMPLETED: "Завершен",
  PAYMENT_REVIEW: "Проверка оплаты",
  CANCELLED: "Отменен"
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  PENDING: "Ожидает",
  UPON_RECEIPT: "При получении",
  PAID: "Оплачен",
  PARTIALLY_REFUNDED: "Частично возвращён",
  REFUNDED: "Возвращён",
  CANCELLED: "Отменен"
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  ONLINE: "Онлайн",
  OFFLINE: "Офлайн"
};

export const obtainingMethodLabels: Record<ObtainingMethod, string> = {
  DELIVERY: "Доставка",
  PICKUP: "Самовывоз"
};

export const deliveryMethodLabels: Record<DeliveryMethod, string> = {
  OZON: "Служба доставки OZON",
  CDEK: "Служба доставки СДЭК"
};

export function getDeliveryMethodLabel(value: DeliveryMethod | null | undefined) {
  return value ? deliveryMethodLabels[value] : "Служба доставки не указана";
}

export const orderStatusColor: Record<OrderStatus, "neutral" | "primary" | "warning" | "success" | "error" | "info"> = {
  NEW: "info",
  CONFIRMED: "primary",
  PROCESSING: "warning",
  SHIPPED: "primary",
  COMPLETED: "success",
  PAYMENT_REVIEW: "warning",
  CANCELLED: "error"
};

export const paymentStatusColor: Record<PaymentStatus, "neutral" | "primary" | "warning" | "success" | "error" | "info"> = {
  PENDING: "warning",
  UPON_RECEIPT: "info",
  PAID: "success",
  PARTIALLY_REFUNDED: "warning",
  REFUNDED: "neutral",
  CANCELLED: "error"
};

export function toNumber(value: MoneyLike) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  return Number(value);
}

export function formatCurrency(value: MoneyLike) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0
  }).format(toNumber(value));
}

export function formatNumber(value: number | string | null | undefined) {
  return new Intl.NumberFormat("ru-RU").format(Number(value ?? 0));
}

export function formatPercent(value: number | string | null | undefined) {
  return new Intl.NumberFormat("ru-RU", {
    style: "percent",
    maximumFractionDigits: 1
  }).format(Number(value ?? 0));
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function formatShortDate(value: string | Date | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short"
  }).format(date);
}

export function getErrorMessage(error: unknown, fallback = "Не удалось выполнить действие") {
  if (typeof error === "object" && error && "data" in error) {
    const data = (error as { data?: { message?: string; data?: Record<string, string[]> } }).data;

    if (data?.message) {
      return data.message;
    }

    const firstFieldError = data?.data ? Object.values(data.data).flat()[0] : undefined;
    if (firstFieldError) {
      return firstFieldError;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function buildQuery(params: Record<string, string | number | boolean | null | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function todayDateKey() {
  return formatDateInputValue(new Date());
}

export function shiftDateKey(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatDateInputValue(date);
}

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
