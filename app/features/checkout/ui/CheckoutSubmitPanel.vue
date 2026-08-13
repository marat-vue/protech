<template>
  <section class="rounded-[1.75rem] bg-zinc-950 p-4 text-white shadow-[0_22px_80px_rgba(15,23,42,0.16)] sm:p-5   ">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-xs font-semibold uppercase text-white/50">К оплате</p>
        <p class="mt-1 text-3xl font-semibold tracking-normal">
          {{ formatCurrency(totalAmount) }}
        </p>
      </div>

      <dl class="grid min-w-44 gap-2 text-sm">
        <div class="flex items-center justify-between gap-4">
          <dt class="text-white/55">Товаров</dt>
          <dd class="font-semibold">{{ totalItems }} шт.</dd>
        </div>
        <div class="flex items-center justify-between gap-4">
          <dt class="text-white/55">Получение</dt>
          <dd class="font-semibold">{{ deliveryLabel }}</dd>
        </div>
        <div v-if="discountAmount > 0" class="flex items-center justify-between gap-4 text-emerald-300">
          <dt>Скидка {{ promoDiscountPercent }}%</dt>
          <dd class="font-semibold">−{{ formatCurrency(discountAmount) }}</dd>
        </div>
        <div v-if="discountAmount > 0" class="flex items-center justify-between gap-4">
          <dt class="text-white/55">Товары без скидки</dt>
          <dd class="font-semibold text-white/70 line-through">{{ formatCurrency(subtotal) }}</dd>
        </div>
      </dl>
    </div>

    <p v-if="deliveryCostPending" class="mt-3 text-xs leading-5 text-amber-200/90">
      В сумму входит только товар. Стоимость доставки менеджер рассчитает и согласует отдельно.
    </p>

    <div v-if="appliedPromoCode"
      class="relative mt-5 overflow-hidden rounded-[1.35rem] bg-emerald-400/10 p-4 ring-1 ring-inset ring-emerald-300/20"
    >
      <div class="pointer-events-none absolute -right-7 -top-8 size-24 rounded-full bg-emerald-300/10 blur-xl" />
      <div class="relative flex items-center gap-3">
        <span class="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-300 text-emerald-950 shadow-lg shadow-emerald-950/20">
          <UIcon name="i-lucide-badge-check" class="size-5" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-300">Промокод применён</p>
          <p class="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span class="truncate text-base font-semibold tracking-wide text-white">{{ appliedPromoCode }}</span>
            <span class="text-xs font-medium text-emerald-200">Скидка {{ promoDiscountPercent }}%</span>
          </p>
        </div>
        <UButton color="neutral" variant="ghost" icon="i-lucide-x" square
          class="shrink-0 rounded-full text-white/60 hover:bg-white/10 hover:text-white"
          aria-label="Удалить промокод" @click="emit('removePromo')" />
      </div>
    </div>

    <form v-else
      class="mt-5 rounded-[1.35rem] bg-white/[0.07] p-3 ring-1 ring-inset ring-white/10"
      @submit.prevent="emit('applyPromo')"
    >
      <div class="flex items-center gap-3 px-1 pb-3">
        <span class="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-300 text-amber-950 shadow-lg shadow-black/15">
          <UIcon name="i-lucide-ticket-percent" class="size-4.5" />
        </span>
        <div class="min-w-0">
          <label for="checkout-promo-code" class="block text-sm font-semibold text-white">Есть промокод?</label>
          <p class="mt-0.5 text-xs text-white/45">Введите его, чтобы пересчитать стоимость</p>
        </div>
      </div>

      <div class="flex items-center gap-1.5 rounded-[1.05rem] bg-white p-1.5 shadow-[0_12px_35px_rgba(0,0,0,0.18)] ring-2 transition"
        :class="promoError ? 'ring-red-400/80' : 'ring-transparent focus-within:ring-amber-300/80'"
      >
        <UInput id="checkout-promo-code"
          :model-value="promoCode"
          size="lg"
          variant="none"
          placeholder="Например, SALE10"
          autocomplete="off"
          :aria-invalid="promoError ? 'true' : undefined"
          class="min-w-0 flex-1 text-zinc-950"
          :ui="{ base: 'h-11 rounded-xl bg-transparent pl-3 font-semibold uppercase tracking-[0.08em] placeholder:font-normal placeholder:normal-case placeholder:tracking-normal' }"
          @update:model-value="emit('updatePromoCode', String($event))"
        />
        <UButton color="neutral" variant="solid" type="submit" size="lg" :loading="promoLoading"
          icon="i-lucide-arrow-right"
          class="min-h-11 shrink-0 justify-center rounded-xl bg-zinc-950 px-4 font-semibold text-white shadow-md shadow-zinc-950/20 hover:bg-zinc-800"
        >
          <span class="hidden sm:inline">Применить</span>
          <span class="sm:hidden">Готово</span>
        </UButton>
      </div>

      <p v-if="promoError" class="mt-2 flex items-center gap-1.5 px-1 text-xs leading-5 text-red-300" role="alert">
        <UIcon name="i-lucide-circle-alert" class="size-3.5 shrink-0" />
        {{ promoError }}
      </p>
    </form>

    <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
      <div v-if="previewItems.length"
        class="flex items-center gap-3"
      >
        <div class="flex -space-x-2">
          <img v-for="item in previewItems"
            :key="item.id"
            :src="item.product.mainImage || '/favicon.ico'"
            :alt="item.product.name"
            class="size-10 rounded-2xl object-cover ring-2 ring-zinc-950 "
          >
        </div>
        <p class="text-xs text-white/55 ">
          {{ hiddenItemsCount > 0 ? `+${hiddenItemsCount} поз.` : "Все позиции видны" }}
        </p>
      </div>

      <UButton :color="onlinePayment ? 'neutral' : 'primary'"
        size="xl"
        :icon="onlinePayment ? 'i-lucide-lock-keyhole' : 'i-lucide-check-circle-2'"
        class="min-h-14 w-full justify-center rounded-full px-8 text-base font-semibold transition duration-300 hover:scale-[1.01] sm:w-auto sm:min-w-72"
        :class="onlinePayment ? 'bg-[#005bff] text-white hover:bg-[#004ee0]' : ''"
        :loading="submitting"
        @click="emit('submit')"
      >
        {{ onlinePayment ? "Оплатить через Ozon Pay" : "Подтвердить заказ" }}
      </UButton>
    </div>

    <p v-if="onlinePayment" class="mt-4 flex items-center gap-2 text-xs leading-5 text-white/55">
      <UIcon name="i-lucide-shield-check" class="size-4 shrink-0 text-[#72a5ff]" />
      После создания заказа откроется защищённая платёжная страница Ozon Pay.
    </p>

    <UAlert v-if="submitError"
      color="error"
      variant="soft"
      :description="submitError"
      class="mt-4 rounded-3xl"
    />
  </section>
</template>

<script setup lang="ts">
import { formatCurrency } from "~~/app/shared/lib/shopFormatters";
import type { CartItem } from "~~/app/shared/types/shop";

defineProps<{
  deliveryCostPending: boolean;
  deliveryLabel: string;
  hiddenItemsCount: number;
  onlinePayment: boolean;
  appliedPromoCode: string;
  discountAmount: number;
  promoCode: string;
  promoDiscountPercent: number;
  promoError: string;
  promoLoading: boolean;
  previewItems: CartItem[];
  submitError: string;
  submitting: boolean;
  subtotal: number;
  totalAmount: number;
  totalItems: number;
}>();

const emit = defineEmits<{
  applyPromo: [];
  removePromo: [];
  submit: [];
  updatePromoCode: [value: string];
}>();
</script>
