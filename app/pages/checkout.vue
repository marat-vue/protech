<template>
  <div class="min-h-screen bg-[#f9fafb] pb-24 text-zinc-950 md:pb-0  ">
    <div v-if="loading"
      class="mx-auto grid w-full max-w-370 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)] lg:px-8 lg:py-10">
      <USkeleton class="h-144 rounded-4xl" />
      <USkeleton class="h-[calc(100vh-8rem)] min-h-155 rounded-4xl" />
    </div>

    <div v-else-if="!auth.user"
      class="mx-auto grid min-h-[calc(100vh-8rem)] w-full max-w-370 place-items-center px-4 py-8 sm:px-6 lg:px-8">
      <CheckoutStateCard button-icon="i-lucide-log-in" button-label="Войти"
        description="Авторизуйтесь, чтобы оформить заказ и сохранить его в истории." icon="i-lucide-lock-keyhole"
        title="Нужен вход в аккаунт" to="/auth?redirect=/checkout" />
    </div>

    <div v-else-if="!cart.items.length"
      class="mx-auto grid min-h-[calc(100vh-8rem)] w-full max-w-370 place-items-center px-4 py-8 sm:px-6 lg:px-8">
      <CheckoutStateCard button-icon="i-lucide-layout-grid" button-label="В каталог"
        description="Добавьте товары из каталога, а затем вернитесь к оформлению." icon="i-lucide-shopping-cart"
        title="Корзина пуста" to="/" />
    </div>

    <div v-else
      class="mx-auto grid w-full max-w-370 gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)] lg:px-8 lg:py-8 xl:gap-6">
      <div v-auto-animate class="space-y-4 lg:pb-8">
        <CheckoutOverviewCard />

        <CheckoutContactSection :customer-phone-error="fieldErrors.customerPhone" :phone="draft.customerPhone"
          :recipient-is-another-person="draft.recipientIsAnotherPerson" :recipient-name="draft.recipientName"
          :recipient-name-error="fieldErrors.recipientName" :recipient-phone="draft.recipientPhone"
          :recipient-phone-error="fieldErrors.recipientPhone"
          @update-phone="updateCheckoutField('customerPhone', $event)"
          @update-recipient-is-another-person="updateRecipientIsAnotherPerson"
          @update-recipient-name="updateCheckoutField('recipientName', $event)"
          @update-recipient-phone="updateCheckoutField('recipientPhone', $event)" />

        <CheckoutChoiceGroupsSection :delivery-method="draft.deliveryMethod" :delivery-options="deliveryOptions"
          :is-delivery="isDelivery" :obtaining-method="draft.obtainingMethod" :obtaining-options="obtainingOptions"
          :payment-method="draft.paymentMethod" :payment-options="paymentOptions" @select-delivery="setDeliveryMethod"
          @select-obtaining="setObtainingMethod" @select-payment="setPaymentMethod" />
        <CheckoutDeliveryDetailsSection :delivery-method="draft.deliveryMethod" :draft="draft"
          :field-errors="fieldErrors" :is-delivery="isDelivery" @update-field="updateCheckoutField" />
      </div>

      <aside class="space-y-4 lg:sticky lg:top-28 lg:self-start">
        <CheckoutDeliveryMap :city="draft.city" :delivery-method="draft.deliveryMethod" :house="draft.house"
          :obtaining-method="draft.obtainingMethod" :street="draft.street" />

        <CheckoutSubmitPanel :delivery-label="deliveryLabel" :hidden-items-count="hiddenCheckoutItemsCount"
          :online-payment="isDelivery || draft.paymentMethod === 'ONLINE'"
          :preview-items="checkoutPreviewItems" :submit-error="submitError" :submitting="submitting"
          :subtotal="cart.subtotal" :total-items="cart.totalItems" :total-amount="checkoutTotal"
          :applied-promo-code="appliedPromo?.code ?? ''" :discount-amount="appliedPromo?.discountAmount ?? 0"
          :promo-code="promoCodeInput" :promo-discount-percent="appliedPromo?.discountPercent ?? 0"
          :promo-error="promoError" :promo-loading="promoLoading" @apply-promo="applyPromoCode"
          @remove-promo="removePromoCode" @update-promo-code="updatePromoCode" @submit="submitOrder" />
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { toast } from "vue-sonner";
import { getErrorMessage } from "~~/app/shared/lib/shopFormatters";
import { shopFetch } from "~~/app/shared/lib/shopFetch";
import type { DeliveryMethod, ObtainingMethod, PaymentMethod } from "~~/app/shared/types/shop";
import { useAuthStore } from "~~/app/stores/auth";
import { useCartStore, type CheckoutDraft } from "~~/app/stores/cart";

type CreateOrderResponse = {
  order: {
    id: number;
  };
  payment: {
    type: "offline" | "ozon";
    status?: string;
    confirmationUrl: string | null;
  };
};

type CheckoutChoice<TValue extends string> = {
  value: TValue;
  title: string;
  description: string;
  icon: string;
  badge?: string;
  brand?: "ozon";
  disabled?: boolean;
};
type AppliedPromo = {
  code: string;
  discountPercent: number;
  discountAmount: number;
  totalAmount: number;
};
type CheckoutTextField = keyof Omit<CheckoutDraft, "deliveryMethod" | "obtainingMethod" | "paymentMethod" | "recipientIsAnotherPerson">;

useSeoMeta({
  title: "Оформление заказа",
  description: "Оформление заказа ПроТех76 с выбором доставки, оплаты и адресом на карте.",
  robots: "noindex, nofollow"
});

const auth = useAuthStore();
const cart = useCartStore();
const draft = cart.checkoutDraft;
const loading = ref(true);
const submitting = ref(false);
const submitError = ref("");
const promoCodeInput = ref("");
const promoError = ref("");
const promoLoading = ref(false);
const appliedPromo = ref<AppliedPromo | null>(null);
const fieldErrors = reactive<Record<string, string | undefined>>({});
const obtainingOptions: Array<CheckoutChoice<ObtainingMethod>> = [
  {
    value: "DELIVERY",
    title: "Доставка",
    description: "Курьерская доставка OZON или СДЭК по указанному адресу.",
    icon: "i-lucide-truck"
  },
  {
    value: "PICKUP",
    title: "Самовывоз",
    description: "Ярославль, пр.-т Октября, д. 78д. По предварительной записи.",
    icon: "i-lucide-store"
  }
];

const isDelivery = computed(() => draft.obtainingMethod === "DELIVERY");
const deliveryOptions: Array<CheckoutChoice<DeliveryMethod>> = [
  {
    value: "OZON",
    title: "OZON",
    description: "Доставка через службу OZON по адресу заказа.",
    icon: "i-lucide-truck"
  },
  {
    value: "CDEK",
    title: "СДЭК",
    description: "Доставка через СДЭК по адресу заказа.",
    icon: "i-lucide-package-check"
  }
];
const deliveryMethodLabels: Record<DeliveryMethod, string> = {
  OZON: "служба доставки OZON",
  CDEK: "служба доставки СДЭК"
};
const selectedDeliveryLabel = computed(() => deliveryMethodLabels[draft.deliveryMethod] ?? deliveryMethodLabels.OZON);
const deliveryLabel = computed(() => isDelivery.value ? selectedDeliveryLabel.value : "самовывоз");
const customerPhone = computed(() => (draft.customerPhone ?? "").trim());
const recipientName = computed(() => (draft.recipientName ?? "").trim());
const recipientPhone = computed(() => (draft.recipientPhone ?? "").trim());
const checkoutPreviewItems = computed(() => cart.items.slice(0, 4));
const hiddenCheckoutItemsCount = computed(() => Math.max(cart.items.length - checkoutPreviewItems.value.length, 0));
const checkoutTotal = computed(() => appliedPromo.value?.totalAmount ?? cart.subtotal);
const paymentOptions = computed<Array<CheckoutChoice<PaymentMethod>>>(() => [
  {
    value: "ONLINE",
    title: "Ozon Pay",
    description: "Банковская карта, СБП или Ozon Карта. Доступны карты из Ozon ID.",
    icon: "i-lucide-shield-check",
    badge: isDelivery.value ? "обязательно" : "безопасно",
    brand: "ozon"
  },
  {
    value: "OFFLINE",
    title: "При получении",
    description: "Только для самовывоза.",
    icon: "i-lucide-wallet",
    disabled: isDelivery.value
  }
]);

onMounted(async () => {
  draft.deliveryMethod = draft.deliveryMethod ?? "OZON";
  draft.customerPhone = draft.customerPhone ?? "";
  draft.recipientIsAnotherPerson = draft.recipientIsAnotherPerson ?? false;
  draft.recipientName = draft.recipientName ?? "";
  draft.recipientPhone = draft.recipientPhone ?? "";

  const user = auth.user ?? await auth.fetchMe();

  if (user) {
    await cart.fetchCart();
  }

  loading.value = false;
});

function setObtainingMethod(value: ObtainingMethod) {
  draft.obtainingMethod = value;

  if (value === "DELIVERY") {
    draft.paymentMethod = "ONLINE";
    draft.deliveryMethod = draft.deliveryMethod ?? "OZON";
  }
}

function setDeliveryMethod(value: DeliveryMethod) {
  draft.deliveryMethod = value;
}

function setPaymentMethod(value: PaymentMethod) {
  if (isDelivery.value && value === "OFFLINE") {
    return;
  }

  draft.paymentMethod = value;
}

function updateCheckoutField(field: CheckoutTextField, value: string) {
  draft[field] = value;
  fieldErrors[field] = undefined;
}

function updateRecipientIsAnotherPerson(value: boolean) {
  draft.recipientIsAnotherPerson = value;
  fieldErrors.recipientName = undefined;
  fieldErrors.recipientPhone = undefined;

  if (!value) {
    draft.recipientName = "";
    draft.recipientPhone = "";
  }
}

function validateDelivery() {
  fieldErrors.city = undefined;
  fieldErrors.street = undefined;
  fieldErrors.house = undefined;

  if (!isDelivery.value) {
    return true;
  }

  if (!draft.city.trim()) fieldErrors.city = "Введите город";
  if (!draft.street.trim()) fieldErrors.street = "Введите улицу";
  if (!draft.house.trim()) fieldErrors.house = "Введите дом";

  return !fieldErrors.city && !fieldErrors.street && !fieldErrors.house;
}

function validateContact() {
  fieldErrors.customerPhone = undefined;
  fieldErrors.recipientName = undefined;
  fieldErrors.recipientPhone = undefined;

  if (!customerPhone.value) {
    fieldErrors.customerPhone = "Введите телефон";
  } else if (!/^\+?[0-9\s().-]{5,30}$/.test(customerPhone.value)) {
    fieldErrors.customerPhone = "Введите корректный телефон";
  }

  if (draft.recipientIsAnotherPerson) {
    if (!recipientName.value) {
      fieldErrors.recipientName = "Введите имя получателя";
    } else if (recipientName.value.length < 2) {
      fieldErrors.recipientName = "Имя должно содержать не менее 2 символов";
    }

    if (!recipientPhone.value) {
      fieldErrors.recipientPhone = "Введите телефон получателя";
    } else if (!/^\+?[0-9\s().-]{5,30}$/.test(recipientPhone.value)) {
      fieldErrors.recipientPhone = "Введите корректный телефон";
    }
  }

  return !fieldErrors.customerPhone && !fieldErrors.recipientName && !fieldErrors.recipientPhone;
}

function fullAddress() {
  return [draft.city, draft.street, draft.house]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

function updatePromoCode(value: string) {
  promoCodeInput.value = value.toUpperCase();
  promoError.value = "";
}

async function applyPromoCode() {
  const code = promoCodeInput.value.trim();

  if (!code) {
    promoError.value = "Введите промокод";
    return;
  }

  promoLoading.value = true;
  promoError.value = "";

  try {
    const result = await shopFetch<{
      code: string;
      discountPercent: number;
      discountAmount: number | string;
      totalAmount: number | string;
    }>("/api/public/promo-codes/validate", {
      method: "POST",
      body: { code, orderItems: cart.orderItems }
    });
    appliedPromo.value = {
      code: result.code,
      discountPercent: result.discountPercent,
      discountAmount: Number(result.discountAmount),
      totalAmount: Number(result.totalAmount)
    };
    promoCodeInput.value = result.code;
    toast.success(`Промокод применён: скидка ${result.discountPercent}%`);
  } catch (error) {
    appliedPromo.value = null;
    promoError.value = getErrorMessage(error, "Не удалось применить промокод");
  } finally {
    promoLoading.value = false;
  }
}

function removePromoCode() {
  appliedPromo.value = null;
  promoCodeInput.value = "";
  promoError.value = "";
}

async function submitOrder() {
  submitError.value = "";

  const contactValid = validateContact();
  const deliveryValid = validateDelivery();

  if (!contactValid || !deliveryValid) {
    submitError.value = "Заполните обязательные поля";
    return;
  }

  submitting.value = true;

  try {
    const result = await shopFetch<CreateOrderResponse>("/api/public/orders", {
      method: "POST",
      body: {
        obtainingMethod: draft.obtainingMethod,
        paymentMethod: isDelivery.value ? "ONLINE" : draft.paymentMethod,
        customerPhone: customerPhone.value,
        ...(appliedPromo.value ? { promoCode: appliedPromo.value.code } : {}),
        ...(draft.recipientIsAnotherPerson
          ? {
            recipient: {
              name: recipientName.value,
              phone: recipientPhone.value
            }
          }
          : {}),
        orderItems: cart.orderItems,
        ...(isDelivery.value
          ? {
            delivery: {
              address: fullAddress(),
              apartment: draft.apartment.trim() || undefined,
              entrance: draft.entrance.trim() || undefined,
              floor: draft.floor.trim() || undefined,
              intercom: draft.intercom.trim() || undefined,
              comment: draft.comment.trim() || undefined,
              deliveryMethod: draft.deliveryMethod
            }
          }
          : {})
      }
    });

    await cart.clear().catch(() => {
      cart.items = [];
    });
    cart.resetCheckoutDraft();
    toast.success("Заказ создан");

    if (result.payment.confirmationUrl) {
      await navigateTo(result.payment.confirmationUrl, { external: true });
      return;
    }

    await navigateTo(`/orders/${result.order.id}`);
  } catch (error) {
    submitError.value = getErrorMessage(error, "Не удалось создать заказ");
    toast.error(submitError.value);
  } finally {
    submitting.value = false;
  }
}
</script>
