<template>
  <section v-if="isPendingPayment"
    class="rounded-[1.35rem] bg-[#f3f7ff] p-4 text-blue-950 ring-1 ring-[#005bff]/20"
    :class="compact ? 'mt-3' : ''">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0">
        <p class="inline-flex items-center gap-2 text-sm font-semibold">
          <UIcon name="i-lucide-clock-3" class="size-4 shrink-0" />
          {{ isCreationUncertain ? "Проверяем платёжную ссылку" : "Ожидает оплаты" }}
        </p>
        <p class="mt-1 text-sm leading-6 text-blue-900/70">
          <template v-if="isCreationUncertain">
            Не создавайте новый заказ: результат запроса к Ozon Pay ещё уточняется.
          </template>
          <template v-else>
            Ozon Pay · до автоматической отмены: <span class="font-semibold text-blue-950">{{ formattedRemaining }}</span>
          </template>
        </p>
      </div>

      <UButton color="primary" icon="i-lucide-credit-card" :loading="submitting" :disabled="remainingSeconds <= 0 || isCreationUncertain"
        class="min-h-11 justify-center rounded-full bg-[#005bff] px-5 font-semibold text-white hover:bg-[#004ee0]"
        :class="compact ? 'w-full sm:w-auto' : 'w-full sm:min-w-48 sm:w-auto'" @click.stop="resumePayment">
        {{ isCreationUncertain ? "Идёт проверка" : remainingSeconds > 0 ? "Перейти в Ozon Pay" : "Время истекло" }}
      </UButton>
    </div>

    <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-blue-200/70">
      <div class="h-full rounded-full bg-[#005bff] transition-[width] duration-500"
        :style="{ width: `${progressPercent}%` }" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { toast } from "vue-sonner";
import { getErrorMessage } from "~~/app/shared/lib/shopFormatters";
import { shopFetch } from "~~/app/shared/lib/shopFetch";
import type { ShopOrder } from "~~/app/shared/types/shop";

type ResumePaymentResponse = {
  confirmationUrl: string;
  paymentExpiresAt: string;
  paymentRemainingSeconds: number;
};

const props = withDefaults(defineProps<{
  compact?: boolean;
  order: ShopOrder;
}>(), {
  compact: false
});

const submitting = ref(false);
const remainingSeconds = ref(getRemainingSeconds());
let timer: ReturnType<typeof setInterval> | undefined;

const isPendingPayment = computed(() => (
  props.order.paymentMethod === "ONLINE" &&
  props.order.orderStatus === "NEW" &&
  props.order.payment?.paymentStatus === "PENDING"
));
const isCreationUncertain = computed(() => (
  props.order.payment?.creationStatus === "CREATING" ||
  props.order.payment?.creationStatus === "UNKNOWN"
));
const totalSeconds = computed(() => {
  const expiresAt = getExpiresAtTime();
  const createdAt = new Date(props.order.createdAt).getTime();

  if (!expiresAt || Number.isNaN(createdAt)) {
    return Math.max(remainingSeconds.value, 1);
  }

  return Math.max(1, Math.ceil((expiresAt - createdAt) / 1000));
});
const progressPercent = computed(() => Math.max(0, Math.min(100, remainingSeconds.value / totalSeconds.value * 100)));
const formattedRemaining = computed(() => formatDuration(remainingSeconds.value));

if (import.meta.client) {
  onMounted(() => {
    scheduleTimer();
  });

  watch(
    () => [props.order.id, props.order.paymentExpiresAt, props.order.payment?.paymentStatus],
    () => scheduleTimer()
  );

  onUnmounted(() => {
    clearTimer();
  });
}

async function resumePayment() {
  if (remainingSeconds.value <= 0) {
    toast.error("Время оплаты истекло. Обновите заказ, чтобы увидеть актуальный статус.");
    return;
  }

  submitting.value = true;

  try {
    const result = await shopFetch<ResumePaymentResponse>(`/api/public/orders/${props.order.id}/pay`, {
      method: "POST"
    });

    await navigateTo(result.confirmationUrl, { external: true });
  } catch (error) {
    toast.error(getErrorMessage(error, "Не удалось открыть страницу оплаты"));
  } finally {
    submitting.value = false;
  }
}

function scheduleTimer() {
  clearTimer();
  updateRemainingSeconds();

  if (!isPendingPayment.value) {
    return;
  }

  timer = setInterval(updateRemainingSeconds, 1000);
}

function clearTimer() {
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }
}

function updateRemainingSeconds() {
  remainingSeconds.value = getRemainingSeconds();
}

function getRemainingSeconds() {
  const expiresAt = getExpiresAtTime();

  if (expiresAt) {
    return Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
  }

  return Math.max(0, props.order.paymentRemainingSeconds ?? 0);
}

function getExpiresAtTime() {
  if (!props.order.paymentExpiresAt) {
    return null;
  }

  const time = new Date(props.order.paymentExpiresAt).getTime();

  return Number.isNaN(time) ? null : time;
}

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const restSeconds = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(restSeconds)}`;
  }

  return `${minutes}:${pad(restSeconds)}`;
}
</script>
