<template>
  <div class="callback-requests-page space-y-5">
    <AdminPageHeader title="Заявки на звонок"
      kicker="Обратная связь"
      description="Новые обращения из публичной формы, контактные данные и история обработки."
    >
      <template #actions>
        <UButton color="neutral"
          variant="ghost"
          icon="i-lucide-refresh-cw"
          size="lg"
          class="h-12 justify-center rounded-full bg-white px-4 text-zinc-600 shadow-sm shadow-zinc-950/5 hover:bg-zinc-100"
          :loading="pending"
          @click="refresh()"
        >
          Обновить
        </UButton>
      </template>
    </AdminPageHeader>

    <section class="rounded-3xl bg-white/90 p-4 shadow-[0_18px_60px_rgba(24,24,27,0.06)] backdrop-blur sm:p-5">
      <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(13rem,18rem)]">
        <label class="block min-w-0 rounded-2xl bg-[#f9fafb] p-3 shadow-inner shadow-zinc-950/5">
          <span class="mb-2 block px-1 text-xs font-semibold uppercase text-zinc-400">Поиск</span>
          <UInput v-model="search"
            class="w-full rounded-2xl bg-white shadow-sm shadow-zinc-950/5"
            size="lg"
            variant="none"
            icon="i-lucide-search"
            placeholder="Имя или телефон"
            :ui="inputUi"
          />
        </label>

        <label class="block min-w-0 rounded-2xl bg-[#f9fafb] p-3 shadow-inner shadow-zinc-950/5">
          <span class="mb-2 block px-1 text-xs font-semibold uppercase text-zinc-400">Статус</span>
          <USelect v-model="status"
            class="w-full rounded-2xl bg-white shadow-sm shadow-zinc-950/5"
            size="lg"
            color="neutral"
            variant="none"
            icon="i-lucide-list-filter"
            :items="statusFilterItems"
            :content="selectContent"
            :ui="selectUi"
          />
        </label>
      </div>
    </section>

    <UAlert v-if="error"
      color="error"
      variant="soft"
      title="Не удалось загрузить заявки"
      :description="getErrorMessage(error)"
      class="rounded-2xl"
    />

    <section class="admin-list-card">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
        <div>
          <p class="admin-section-heading">Очередь обратных звонков</p>
          <p class="admin-section-copy">Сначала отображаются новые и активные обращения.</p>
        </div>
        <UBadge color="neutral" variant="soft" class="rounded-full px-3 py-1">
          {{ callbackRequestsData?.pagination.total ?? 0 }} всего
        </UBadge>
      </div>

      <div v-if="callbackRequests.length" class="grid gap-4 bg-[#f9fafb] p-3 sm:p-4 2xl:grid-cols-2">
        <article v-for="request in callbackRequests"
          :key="request.id"
          class="rounded-[1.5rem] bg-white p-4 shadow-[0_18px_50px_rgba(24,24,27,0.08)] ring-1 ring-zinc-200/80 sm:p-5"
        >
          <div class="flex items-start gap-3">
            <span class="grid size-12 shrink-0 place-items-center rounded-2xl bg-(--admin-accent-soft) text-(--admin-accent-strong)">
              <PhoneCall class="size-5" />
            </span>

            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="truncate font-semibold text-zinc-950">{{ request.name }}</h2>
                <UBadge :color="callbackRequestStatusColor[request.status]"
                  variant="soft"
                  class="rounded-full px-3 py-1"
                >
                  {{ callbackRequestStatusLabels[request.status] }}
                </UBadge>
              </div>
              <a :href="phoneHref(request.phone)"
                class="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-700 hover:text-(--admin-accent-strong)"
              >
                <Phone class="size-4" />
                {{ request.phone }}
              </a>
            </div>

            <span class="shrink-0 text-xs text-zinc-400">№{{ request.id }}</span>
          </div>

          <div class="mt-4 grid gap-3 sm:grid-cols-2">
            <div class="rounded-2xl bg-[#f9fafb] p-3">
              <p class="text-xs font-semibold uppercase text-zinc-400">Создана</p>
              <p class="mt-2 text-sm font-medium text-zinc-700">{{ formatDate(request.createdAt) }}</p>
            </div>
            <div class="rounded-2xl bg-[#f9fafb] p-3">
              <p class="text-xs font-semibold uppercase text-zinc-400">Источник</p>
              <NuxtLink v-if="request.sourcePath"
                :to="request.sourcePath"
                class="mt-2 block truncate text-sm font-medium text-zinc-700 hover:text-(--admin-accent-strong)"
                target="_blank"
              >
                {{ request.sourcePath }}
              </NuxtLink>
              <p v-else class="mt-2 text-sm text-zinc-400">Не указан</p>
            </div>
          </div>

          <div class="mt-4 grid gap-4 md:grid-cols-[minmax(12rem,0.7fr)_minmax(0,1.3fr)]">
            <label class="block min-w-0">
              <span class="mb-2 block px-1 text-xs font-semibold uppercase text-zinc-400">Статус</span>
              <USelect :model-value="draftFor(request).status"
                class="w-full rounded-2xl bg-[#f9fafb]"
                size="lg"
                color="neutral"
                variant="none"
                :items="statusItems"
                :content="selectContent"
                :ui="selectUi"
                @update:model-value="updateDraftStatus(request, $event)"
              />
            </label>

            <label class="block min-w-0">
              <span class="mb-2 block px-1 text-xs font-semibold uppercase text-zinc-400">Заметка</span>
              <UTextarea :model-value="draftFor(request).adminNote"
                class="w-full rounded-2xl bg-[#f9fafb]"
                variant="none"
                :rows="3"
                autoresize
                placeholder="Результат разговора или следующий шаг"
                :ui="textareaUi"
                @update:model-value="updateDraftNote(request, $event)"
              />
            </label>
          </div>

          <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div class="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              <span class="rounded-full bg-[#f9fafb] px-3 py-1.5">
                Согласие получено
              </span>
              <span v-if="request.processedAt" class="rounded-full bg-[#f9fafb] px-3 py-1.5">
                Обработана {{ formatDate(request.processedAt) }}
              </span>
            </div>

            <UButton color="primary"
              icon="i-lucide-save"
              class="min-h-11 rounded-full px-5"
              :disabled="!isDirty(request)"
              :loading="savingId === request.id"
              @click="saveRequest(request)"
            >
              Сохранить
            </UButton>
          </div>
        </article>
      </div>

      <AdminEmptyState v-if="!callbackRequests.length && !pending"
        title="Заявок не найдено"
        description="Новые обращения из формы заказа звонка появятся здесь."
      >
        <template #icon>
          <PhoneCall class="size-6" />
        </template>
      </AdminEmptyState>

      <AdminPagination v-if="callbackRequestsData?.pagination"
        :pagination="callbackRequestsData.pagination"
        :loading="pending"
        @update:page="page = $event"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import { Phone, PhoneCall } from "@lucide/vue";
import { watchDebounced } from "@vueuse/core";
import { toast } from "vue-sonner";
import {
  buildQuery,
  callbackRequestStatusColor,
  callbackRequestStatusLabels,
  formatDate,
  getErrorMessage
} from "~~/app/shared/lib/adminFormatters";
import { adminFetch } from "~~/app/shared/lib/adminFetch";
import type {
  AdminCallbackRequest,
  CallbackRequestStatus,
  PaginatedResponse
} from "~~/app/shared/types/admin";
import {
  callbackRequestStatuses,
  updateCallbackRequestSchema
} from "~~/shared/schemas/admin/callbackRequests/updateCallbackRequest";

definePageMeta({
  layout: "admin"
});

type CallbackRequestFilter = CallbackRequestStatus | "all";
type CallbackRequestDraft = {
  status: CallbackRequestStatus;
  adminNote: string;
};

const page = ref(1);
const search = ref("");
const debouncedSearch = ref("");
const status = ref<CallbackRequestFilter>("all");
const savingId = ref<number | null>(null);
const drafts = reactive<Record<number, CallbackRequestDraft>>({});

const inputUi = {
  base: "h-12 rounded-2xl bg-transparent font-medium text-zinc-700"
};
const selectContent = {
  bodyLock: false,
  collisionPadding: 12
};
const selectUi = {
  base: "h-12 rounded-2xl bg-transparent font-medium text-zinc-700",
  content: "max-w-[min(28rem,calc(100vw-1rem))] rounded-2xl bg-white shadow-xl shadow-zinc-950/10 ring-0",
  item: "rounded-xl",
  viewport: "p-1"
};
const textareaUi = {
  base: "min-h-24 rounded-2xl bg-transparent p-3 text-zinc-700"
};
const statusItems = callbackRequestStatuses.map((value) => ({
  value,
  label: callbackRequestStatusLabels[value]
}));
const statusFilterItems = [
  { value: "all", label: "Все статусы" },
  ...statusItems
];

watchDebounced(search, (value) => {
  debouncedSearch.value = value;
  page.value = 1;
}, { debounce: 350, maxWait: 1000 });

watch(status, () => {
  page.value = 1;
});

const query = computed(() => buildQuery({
  page: page.value,
  search: debouncedSearch.value,
  status: status.value === "all" ? null : status.value
}));

const {
  data: callbackRequestsData,
  pending,
  error,
  refresh
} = await useAsyncData(
  "admin-callback-requests",
  () => adminFetch<PaginatedResponse<AdminCallbackRequest>>(`/api/admin/callback-requests${query.value}`),
  { watch: [query] }
);

const callbackRequests = computed(() => callbackRequestsData.value?.items ?? []);

watch(callbackRequests, (items) => {
  for (const item of items) {
    drafts[item.id] = {
      status: item.status,
      adminNote: item.adminNote ?? ""
    };
  }
}, { immediate: true });

function draftFor(request: AdminCallbackRequest) {
  return drafts[request.id] ?? {
    status: request.status,
    adminNote: request.adminNote ?? ""
  };
}

function updateDraftStatus(request: AdminCallbackRequest, value: unknown) {
  drafts[request.id] = {
    ...draftFor(request),
    status: value as CallbackRequestStatus
  };
}

function updateDraftNote(request: AdminCallbackRequest, value: string | number) {
  drafts[request.id] = {
    ...draftFor(request),
    adminNote: String(value)
  };
}

function isDirty(request: AdminCallbackRequest) {
  const draft = draftFor(request);
  return draft.status !== request.status || draft.adminNote.trim() !== (request.adminNote ?? "");
}

function phoneHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

async function saveRequest(request: AdminCallbackRequest) {
  const parsed = updateCallbackRequestSchema.safeParse(draftFor(request));

  if (!parsed.success) {
    toast.error(parsed.error.issues[0]?.message ?? "Проверьте данные заявки");
    return;
  }

  savingId.value = request.id;

  try {
    await adminFetch(`/api/admin/callback-requests/${request.id}`, {
      method: "POST",
      body: parsed.data
    });
    toast.success("Заявка обновлена");
    await refresh();
  } catch (error) {
    toast.error(getErrorMessage(error, "Не удалось обновить заявку"));
  } finally {
    savingId.value = null;
  }
}
</script>
