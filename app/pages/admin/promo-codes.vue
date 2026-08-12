<template>
  <div class="space-y-5">
    <AdminPageHeader title="Промокоды" kicker="Продажи"
      description="Создавайте процентные скидки, включайте и отключайте их и задавайте срок действия.">
      <template #actions>
        <UButton color="neutral" variant="ghost" icon="i-lucide-refresh-cw" size="lg"
          class="h-12 rounded-full bg-white px-4 shadow-sm shadow-zinc-950/5" :loading="pending" @click="refresh()">
          Обновить
        </UButton>
        <UButton color="primary" icon="i-lucide-plus" size="lg" class="h-12 rounded-full px-5" @click="openCreate">
          Добавить промокод
        </UButton>
      </template>
    </AdminPageHeader>

    <section class="rounded-3xl bg-white p-4 shadow-sm shadow-zinc-950/5 sm:p-5">
      <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem]">
        <UInput v-model="search" size="xl" icon="i-lucide-search" placeholder="Найти по коду"
          class="rounded-2xl bg-[#f9fafb]" :ui="inputUi" />
        <USelect v-model="status" size="xl" :items="statusItems" icon="i-lucide-list-filter"
          class="rounded-2xl bg-[#f9fafb]" :ui="selectUi" />
      </div>
    </section>

    <UAlert v-if="error" color="error" variant="soft" title="Не удалось загрузить промокоды"
      :description="getErrorMessage(error)" class="rounded-2xl" />

    <section class="admin-card overflow-hidden">
      <div class="flex items-center justify-between gap-3 border-b border-(--admin-border) px-5 py-4">
        <div>
          <p class="admin-section-heading">Список промокодов</p>
          <p class="admin-section-copy">Всего: {{ data?.pagination.total ?? 0 }}</p>
        </div>
        <UBadge color="neutral" variant="soft" class="rounded-full px-3 py-1">
          {{ activeCount }} активных на странице
        </UBadge>
      </div>

      <div v-if="promoCodes.length" class="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
        <article v-for="promo in promoCodes" :key="promo.id"
          class="rounded-3xl bg-white p-5 shadow-sm shadow-zinc-950/5 ring-1 ring-zinc-200/80">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <UBadge :color="statusMeta(promo).color" variant="soft" class="rounded-full">
                {{ statusMeta(promo).label }}
              </UBadge>
              <h2 class="mt-3 truncate font-mono text-2xl font-bold tracking-wide text-zinc-950">
                {{ promo.code }}
              </h2>
            </div>
            <div class="grid size-16 shrink-0 place-items-center rounded-3xl bg-emerald-50 text-xl font-bold text-emerald-700">
              −{{ promo.discountPercent }}%
            </div>
          </div>

          <dl class="mt-5 grid gap-2 text-sm">
            <div class="flex justify-between gap-3 rounded-2xl bg-[#f9fafb] px-3 py-2.5">
              <dt class="text-zinc-500">Срок действия</dt>
              <dd class="text-right font-semibold text-zinc-800">
                {{ promo.expiresAt ? formatDate(promo.expiresAt) : "Без ограничения" }}
              </dd>
            </div>
            <div class="flex justify-between gap-3 rounded-2xl bg-[#f9fafb] px-3 py-2.5">
              <dt class="text-zinc-500">Использований</dt>
              <dd class="font-semibold text-zinc-800">{{ promo._count.orders }}</dd>
            </div>
          </dl>

          <div class="mt-4 flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" icon="i-lucide-pencil" square class="rounded-full"
              aria-label="Редактировать промокод" @click="openEdit(promo)" />
            <UButton color="error" variant="ghost" icon="i-lucide-trash-2" square class="rounded-full"
              aria-label="Удалить промокод" @click="deletePromoCode(promo)" />
          </div>
        </article>
      </div>

      <AdminEmptyState v-else-if="!pending" title="Промокоды не найдены"
        description="Создайте первый промокод или измените фильтры.">
        <template #icon><UIcon name="i-lucide-badge-percent" class="size-6" /></template>
        <template #actions>
          <UButton color="primary" size="lg" class="rounded-full px-5" @click="openCreate">Добавить промокод</UButton>
        </template>
      </AdminEmptyState>

      <div v-if="pending && !promoCodes.length" class="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
        <USkeleton v-for="index in 3" :key="index" class="h-72 rounded-3xl" />
      </div>

      <AdminPagination v-if="data?.pagination" :pagination="data.pagination" :loading="pending"
        @update:page="page = $event" />
    </section>

    <UModal v-model:open="editorOpen" :ui="modalUi">
      <template #header>
        <div class="flex min-w-0 items-start gap-4">
          <div class="grid size-12 shrink-0 place-items-center rounded-2xl bg-(--admin-accent) text-white shadow-lg shadow-yellow-950/15">
            <UIcon name="i-lucide-badge-percent" class="size-6" />
          </div>
          <div class="min-w-0">
            <p class="text-xs font-semibold uppercase text-(--admin-accent-strong)">Продажи</p>
            <h2 class="mt-1 truncate text-xl font-semibold tracking-normal text-zinc-950 sm:text-2xl">
              {{ editorTitle }}
            </h2>
            <p class="mt-1 max-w-xl text-sm leading-6 text-zinc-500">
              {{ editorDescription }}
            </p>
          </div>
        </div>
      </template>
      <template #body>
        <form id="promo-code-form" class="bg-[#f9fafb] p-4 sm:p-6" @submit.prevent="savePromoCode">
          <section class="space-y-5 rounded-3xl bg-white p-4 shadow-sm shadow-zinc-950/5 ring-1 ring-zinc-200/70 sm:p-5">
            <div class="flex items-start gap-3">
              <span class="grid size-10 shrink-0 place-items-center rounded-2xl bg-(--admin-accent-soft) text-(--admin-accent-strong)">
                <UIcon name="i-lucide-ticket-percent" class="size-5" />
              </span>
              <div>
                <h3 class="text-lg font-semibold text-zinc-950">Условия промокода</h3>
                <p class="mt-1 text-sm leading-6 text-zinc-500">
                  Код, размер скидки, срок действия и доступность на сайте.
                </p>
              </div>
            </div>

            <div class="grid gap-4">
              <UFormField label="Код" required :error="fieldErrors.code">
                <UInput v-model="form.code" size="xl" variant="none" placeholder="Например, SUMMER15"
                  class="w-full rounded-2xl bg-[#f9fafb] shadow-inner shadow-zinc-950/5"
                  :ui="{ base: `${inputUi.base} uppercase placeholder:normal-case` }"
                  @update:model-value="fieldErrors.code = undefined" />
              </UFormField>

              <div class="grid gap-4 sm:grid-cols-2">
                <UFormField label="Скидка, %" required :error="fieldErrors.discountPercent">
                  <UInput v-model.number="form.discountPercent" type="number" min="1" max="99" step="1" size="xl"
                    variant="none" class="w-full rounded-2xl bg-[#f9fafb] shadow-inner shadow-zinc-950/5"
                    :ui="inputUi" @update:model-value="fieldErrors.discountPercent = undefined" />
                </UFormField>
                <UFormField label="Действует до" hint="Необязательно" :error="fieldErrors.expiresAt">
                  <UInput v-model="form.expiresAt" type="datetime-local" size="xl" variant="none"
                    class="w-full rounded-2xl bg-[#f9fafb] shadow-inner shadow-zinc-950/5" :ui="inputUi" />
                </UFormField>
              </div>

              <label class="flex min-h-20 items-center justify-between gap-4 rounded-2xl bg-[#f9fafb] p-4 shadow-inner shadow-zinc-950/5">
                <span>
                  <span class="block text-xs font-semibold uppercase text-zinc-400">Доступность</span>
                  <span class="mt-1 block font-semibold text-zinc-900">Промокод активен</span>
                  <span class="mt-1 block text-xs leading-5 text-zinc-500">Покупатели могут применить его при оформлении заказа</span>
                </span>
                <USwitch v-model="form.isActive" color="primary" />
              </label>
            </div>
          </section>
        </form>
      </template>
      <template #footer>
        <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <UButton color="neutral" variant="ghost" size="lg" class="min-h-12 justify-center rounded-full px-6"
            @click="closeEditor">
            Отмена
          </UButton>
          <UButton color="primary" type="submit" form="promo-code-form" size="lg"
            class="min-h-12 justify-center rounded-full px-6 shadow-lg shadow-yellow-950/10" :loading="submitting">
            <UIcon name="i-lucide-save" class="size-4" />
            Сохранить
          </UButton>
        </div>
      </template>
    </UModal>

    <AdminConfirmModal v-model:open="confirmOpen" v-bind="confirmOptions" :loading="confirmLoading"
      @confirm="runConfirmedAction" />
  </div>
</template>

<script setup lang="ts">
import { toast } from "vue-sonner";
import { adminFetch } from "~~/app/shared/lib/adminFetch";
import { buildQuery, formatDate, getErrorMessage } from "~~/app/shared/lib/adminFormatters";
import { useAdminConfirmation } from "~~/app/shared/lib/useAdminConfirmation";
import { clearFieldErrors, getZodFieldErrors, replaceFieldErrors } from "~~/app/shared/lib/zodValidation";
import type { PaginatedResponse, PromoCodeListItem } from "~~/app/shared/types/admin";
import { promoCodeInputSchema } from "~~/shared/schemas/admin/promoCodes/upsertPromoCode";

definePageMeta({
  layout: "admin"
});

useSeoMeta({ title: "Промокоды — Админка", robots: "noindex, nofollow" });

const page = ref(1);
const search = ref("");
const debouncedSearch = ref("");
const status = ref("all");
const editorOpen = ref(false);
const selectedId = ref<number | null>(null);
const submitting = ref(false);
const fieldErrors = reactive<Record<string, string | undefined>>({});
const form = reactive({ code: "", discountPercent: 10, isActive: true, expiresAt: "" });
const statusItems = [
  { label: "Все статусы", value: "all" },
  { label: "Активные", value: "active" },
  { label: "Отключённые", value: "inactive" },
  { label: "Истёкшие", value: "expired" }
];
const inputUi = { base: "h-12 rounded-2xl bg-transparent font-medium text-zinc-900" };
const selectUi = { base: "h-12 rounded-2xl bg-transparent font-medium text-zinc-900" };
const modalUi = {
  content: "max-h-[calc(100dvh-2rem)] max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl shadow-zinc-950/20 ring-0 sm:max-h-[calc(100dvh-4rem)]",
  header: "shrink-0 border-b border-zinc-100 bg-white/95 px-4 py-4 backdrop-blur sm:px-6",
  body: "min-h-0 flex-1 overflow-y-auto overscroll-contain p-0",
  footer: "shrink-0 border-t border-zinc-100 bg-white/95 px-4 py-4 sm:px-6"
};
const { confirmLoading, confirmOpen, confirmOptions, requestConfirm, runConfirmedAction } = useAdminConfirmation();

watchDebounced(search, (value) => {
  debouncedSearch.value = value;
  page.value = 1;
}, { debounce: 350, maxWait: 1000 });
watch(status, () => { page.value = 1; });

const query = computed(() => buildQuery({
  page: page.value,
  search: debouncedSearch.value,
  status: status.value === "all" ? null : status.value
}));
const { data, pending, error, refresh } = await useAsyncData(
  "admin-promo-codes",
  () => adminFetch<PaginatedResponse<PromoCodeListItem>>(`/api/admin/promo-codes${query.value}`),
  { watch: [query] }
);
const promoCodes = computed(() => data.value?.items ?? []);
const activeCount = computed(() => promoCodes.value.filter((promo) => statusMeta(promo).label === "Активен").length);
const editorTitle = computed(() => selectedId.value ? "Редактировать промокод" : "Новый промокод");
const editorDescription = computed(() => selectedId.value
  ? "Измените код, размер скидки, срок действия или доступность промокода."
  : "Настройте скидку, которую покупатель сможет применить при оформлении заказа."
);

function statusMeta(promo: PromoCodeListItem) {
  if (!promo.isActive) return { label: "Отключён", color: "neutral" as const };
  if (promo.expiresAt && new Date(promo.expiresAt).getTime() <= Date.now()) {
    return { label: "Истёк", color: "warning" as const };
  }
  return { label: "Активен", color: "success" as const };
}

function resetForm() {
  selectedId.value = null;
  Object.assign(form, { code: "", discountPercent: 10, isActive: true, expiresAt: "" });
  clearFieldErrors(fieldErrors);
}

function openCreate() {
  resetForm();
  editorOpen.value = true;
}

function closeEditor() {
  editorOpen.value = false;
}

function openEdit(promo: PromoCodeListItem) {
  selectedId.value = promo.id;
  form.code = promo.code;
  form.discountPercent = promo.discountPercent;
  form.isActive = promo.isActive;
  form.expiresAt = toLocalDateTime(promo.expiresAt);
  clearFieldErrors(fieldErrors);
  editorOpen.value = true;
}

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

async function savePromoCode() {
  const parsed = promoCodeInputSchema.safeParse({
    code: form.code,
    discountPercent: form.discountPercent,
    isActive: form.isActive,
    expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null
  });

  if (!parsed.success) {
    replaceFieldErrors(fieldErrors, getZodFieldErrors(parsed.error));
    toast.error("Проверьте поля промокода");
    return;
  }

  submitting.value = true;
  try {
    await adminFetch(selectedId.value ? `/api/admin/promo-codes/update/${selectedId.value}` : "/api/admin/promo-codes", {
      method: "POST",
      body: parsed.data
    });
    toast.success(selectedId.value ? "Промокод обновлён" : "Промокод создан");
    editorOpen.value = false;
    await refresh();
  } catch (error) {
    toast.error(getErrorMessage(error, "Не удалось сохранить промокод"));
  } finally {
    submitting.value = false;
  }
}

function deletePromoCode(promo: PromoCodeListItem) {
  requestConfirm({
    title: "Удалить промокод",
    description: "Старые заказы сохранят применённую скидку",
    message: `Удалить промокод «${promo.code}»?`,
    confirmLabel: "Удалить",
    color: "error"
  }, async () => {
    try {
      await adminFetch(`/api/admin/promo-codes/delete/${promo.id}`, { method: "POST" });
      toast.success("Промокод удалён");
      await refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось удалить промокод"));
    }
  });
}
</script>
