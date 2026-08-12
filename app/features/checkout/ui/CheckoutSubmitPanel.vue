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

    <div class="mt-5 rounded-3xl bg-white/8 p-3 ring-1 ring-white/10">
      <div v-if="appliedPromoCode" class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="text-xs font-semibold uppercase text-emerald-300">Промокод применён</p>
          <p class="mt-1 truncate font-semibold">{{ appliedPromoCode }} · скидка {{ promoDiscountPercent }}%</p>
        </div>
        <UButton color="neutral" variant="ghost" icon="i-lucide-x" square
          class="shrink-0 rounded-full text-white/70 hover:bg-white/10 hover:text-white"
          aria-label="Удалить промокод" @click="emit('removePromo')" />
      </div>
      <form v-else class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]" @submit.prevent="emit('applyPromo')">
        <UInput :model-value="promoCode" size="lg" variant="none" placeholder="Введите промокод"
          class="rounded-full bg-white text-zinc-950"
          :ui="{ base: 'rounded-full uppercase placeholder:normal-case' }"
          @update:model-value="emit('updatePromoCode', String($event))" />
        <UButton color="neutral" variant="solid" type="submit" size="lg" :loading="promoLoading"
          class="justify-center rounded-full bg-white px-5 text-zinc-950 hover:bg-zinc-100">
          Применить
        </UButton>
      </form>
      <p v-if="promoError" class="mt-2 px-2 text-xs leading-5 text-red-300">{{ promoError }}</p>
    </div>

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
