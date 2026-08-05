<template>
  <section class="rounded-[1.75rem] bg-white/90 p-4 shadow-[0_18px_70px_rgba(15,23,42,0.06)] sm:p-5  ">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <span class="grid size-10 place-items-center rounded-full bg-emerald-50 text-emerald-700  ">
          <UIcon name="i-lucide-route"
            class="size-5"
          />
        </span>
        <div>
          <h2 class="text-base font-semibold tracking-normal text-zinc-950">Получение и оплата</h2>
          <p class="mt-0.5 text-xs leading-5 text-zinc-500">Выберите способ получения, службу доставки и оплату.</p>
        </div>
      </div>

      <UBadge v-if="isDelivery"
        color="primary"
        variant="soft"
        class="rounded-full px-3 py-1"
      >
        {{ deliveryMethod === "CDEK" ? "СДЭК" : "OZON" }}
      </UBadge>
    </div>

    <div class="mt-5 space-y-5">
      <div>
        <div class="flex items-center gap-2 px-1">
          <UIcon name="i-lucide-truck"
            class="size-4.5 text-emerald-700"
          />
          <h3 id="checkout-obtaining-heading" class="text-sm font-semibold tracking-normal text-zinc-950">Получение</h3>
        </div>

        <div class="mt-3 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-labelledby="checkout-obtaining-heading">
          <button v-for="option in obtainingOptions"
            :key="option.value"
            type="button"
            role="radio"
            :aria-checked="obtainingMethod === option.value"
            :class="choiceButtonClass(obtainingMethod === option.value)"
            @click="emit('selectObtaining', option.value)"
          >
            <span :class="choiceIconClass(obtainingMethod === option.value)">
              <UIcon :name="option.icon"
                class="size-4.5"
              />
            </span>
            <span class="min-w-0">
              <span class="block text-sm font-semibold text-zinc-950">{{ option.title }}</span>
              <span class="mt-0.5 block text-xs leading-4 text-zinc-500">{{ option.description }}</span>
            </span>
            <UIcon v-if="obtainingMethod === option.value"
              name="i-lucide-check"
              class="absolute right-3 top-3 size-4 text-emerald-600"
            />
          </button>
        </div>
      </div>

      <div v-if="isDelivery" class="border-t border-zinc-100 pt-5">
        <div class="flex items-center gap-2 px-1">
          <UIcon name="i-lucide-package-check"
            class="size-4.5 text-sky-700"
          />
          <h3 id="checkout-delivery-heading" class="text-sm font-semibold tracking-normal text-zinc-950">Служба доставки</h3>
        </div>

        <div class="mt-3 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-labelledby="checkout-delivery-heading">
          <button v-for="option in deliveryOptions"
            :key="option.value"
            type="button"
            role="radio"
            :aria-checked="deliveryMethod === option.value"
            :class="choiceButtonClass(deliveryMethod === option.value)"
            @click="emit('selectDelivery', option.value)"
          >
            <span :class="choiceIconClass(deliveryMethod === option.value)">
              <UIcon :name="option.icon"
                class="size-4.5"
              />
            </span>
            <span class="min-w-0">
              <span class="block text-sm font-semibold text-zinc-950">{{ option.title }}</span>
              <span class="mt-0.5 block text-xs leading-4 text-zinc-500">{{ option.description }}</span>
            </span>
            <UIcon v-if="deliveryMethod === option.value"
              name="i-lucide-check"
              class="absolute right-3 top-3 size-4 text-emerald-600"
            />
          </button>
        </div>
      </div>

      <div class="border-t border-zinc-100 pt-5">
        <div class="flex items-center gap-2 px-1">
          <UIcon name="i-lucide-credit-card"
            class="size-4.5 text-zinc-700"
          />
          <h3 id="checkout-payment-heading" class="text-sm font-semibold tracking-normal text-zinc-950">Оплата</h3>
        </div>

        <div class="mt-3 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-labelledby="checkout-payment-heading">
          <button v-for="option in paymentOptions"
            :key="option.value"
            type="button"
            :disabled="option.disabled"
            role="radio"
            :aria-checked="paymentMethod === option.value"
            :aria-disabled="option.disabled || undefined"
            :class="choiceButtonClass(paymentMethod === option.value, option.disabled)"
            @click="emit('selectPayment', option.value)"
          >
            <span :class="choiceIconClass(paymentMethod === option.value, option.disabled)">
              <UIcon :name="option.icon"
                class="size-4.5"
              />
            </span>
            <span class="min-w-0">
              <span class="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span class="text-sm font-semibold text-zinc-950">{{ option.title }}</span>
                <span v-if="option.badge"
                  class="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-zinc-500 shadow-sm shadow-zinc-950/5  "
                >
                  {{ option.badge }}
                </span>
              </span>
              <span class="mt-0.5 block text-xs leading-4 text-zinc-500">{{ option.description }}</span>
            </span>
            <UIcon v-if="paymentMethod === option.value"
              name="i-lucide-check"
              class="absolute right-3 top-3 size-4 text-emerald-600"
            />
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { DeliveryMethod, ObtainingMethod, PaymentMethod } from "~~/app/shared/types/shop";

type CheckoutChoice<TValue extends string> = {
  badge?: string;
  description: string;
  disabled?: boolean;
  icon: string;
  title: string;
  value: TValue;
};

defineProps<{
  deliveryMethod: DeliveryMethod;
  deliveryOptions: Array<CheckoutChoice<DeliveryMethod>>;
  isDelivery: boolean;
  obtainingMethod: ObtainingMethod;
  obtainingOptions: Array<CheckoutChoice<ObtainingMethod>>;
  paymentMethod: PaymentMethod;
  paymentOptions: Array<CheckoutChoice<PaymentMethod>>;
}>();

const emit = defineEmits<{
  selectDelivery: [value: DeliveryMethod];
  selectObtaining: [value: ObtainingMethod];
  selectPayment: [value: PaymentMethod];
}>();

function choiceButtonClass(active: boolean, disabled = false) {
  return [
    "group relative flex min-h-[6.5rem] w-full items-start gap-3 rounded-[1.25rem] p-4 pr-10 text-left ring-1 transition duration-300",
    active
      ? "bg-yellow-50 ring-yellow-200 shadow-[0_16px_42px_rgba(161,98,7,0.10)] "
      : "bg-[#f9fafb] ring-zinc-100 shadow-sm shadow-zinc-950/5 hover:-translate-y-0.5 hover:bg-white hover:shadow-lg hover:shadow-zinc-950/8",
    disabled ? "cursor-not-allowed opacity-50 hover:translate-y-0 hover:bg-[#f9fafb] hover:shadow-sm" : ""
  ];
}

function choiceIconClass(active: boolean, disabled = false) {
  return [
    "grid size-10 shrink-0 place-items-center rounded-full transition duration-300",
    active
      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-950/20"
      : "bg-white text-zinc-500 shadow-sm shadow-zinc-950/5 group-hover:text-emerald-700",
    disabled ? "group-hover:text-zinc-500" : ""
  ];
}
</script>
