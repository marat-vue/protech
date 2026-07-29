<template>
  <div class="collections-admin-page space-y-5">
    <AdminPageHeader title="Рубрики" kicker="Каталог"
      description="Подборки и промо-блоки, которые отображаются над фильтрами публичного каталога.">
      <template #actions>
        <UButton color="neutral" variant="ghost" icon="i-lucide-refresh-cw" size="lg"
          class="h-12 justify-center rounded-full bg-white px-4 text-zinc-600 shadow-sm shadow-zinc-950/5 hover:bg-zinc-100"
          :loading="pending" @click="refresh()">
          Обновить
        </UButton>
        <UButton color="primary" variant="solid" icon="i-lucide-plus" size="lg"
          class="h-12 justify-center rounded-full px-4 shadow-lg shadow-orange-950/10" @click="openCreate">
          Добавить рубрику
        </UButton>
      </template>
    </AdminPageHeader>

    <section class="rounded-3xl bg-white/90 p-4 shadow-[0_18px_60px_rgba(24,24,27,0.06)] backdrop-blur sm:p-5">
      <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(11rem,14rem)]">
        <label class="block min-w-0 rounded-2xl bg-[#f9fafb] p-3 shadow-inner shadow-zinc-950/5">
          <span class="mb-2 block px-1 text-xs font-semibold uppercase text-zinc-400">Поиск</span>
          <UInput v-model="search" class="w-full rounded-2xl bg-white shadow-sm shadow-zinc-950/5"
            size="lg" placeholder="Название или описание" variant="none" :ui="inputUi">
            <template #leading>
              <Search class="size-4 text-zinc-400" />
            </template>
          </UInput>
        </label>
        <label class="block min-w-0 rounded-2xl bg-[#f9fafb] p-3 shadow-inner shadow-zinc-950/5">
          <span class="mb-2 block px-1 text-xs font-semibold uppercase text-zinc-400">Статус</span>
          <USelect v-model="status" class="w-full rounded-2xl bg-white shadow-sm shadow-zinc-950/5"
            size="lg" color="neutral" variant="none" icon="i-lucide-circle-check" :items="statusItems"
            :ui="selectUi" />
        </label>
      </div>
    </section>

    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-sm text-zinc-500">
        {{ collectionsStatusText }}
      </p>
      <div v-auto-animate class="flex flex-wrap gap-2">
        <UButton v-if="hasAnyFilter" color="neutral" variant="ghost" size="lg" icon="i-lucide-rotate-ccw"
          class="h-11 rounded-full bg-white px-4 text-zinc-500 shadow-sm shadow-zinc-950/5 hover:bg-zinc-100"
          @click="resetFilters">
          Сбросить
        </UButton>
        <UBadge v-if="search" color="neutral" variant="soft" class="rounded-full px-3 py-1">
          Поиск: {{ search }}
        </UBadge>
        <UBadge v-if="selectedStatusLabel" color="primary" variant="soft" class="rounded-full px-3 py-1">
          {{ selectedStatusLabel }}
        </UBadge>
      </div>
    </div>

    <UAlert v-if="error" color="error" variant="soft" title="Не удалось загрузить рубрики"
      :description="getErrorMessage(error)" class="rounded-2xl" />

    <section class="admin-card">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-(--admin-border) px-5 py-4">
        <div>
          <p class="admin-section-heading">Список рубрик</p>
          <p class="admin-section-copy">Баннер, описание и товары для публичного каталога.</p>
        </div>
        <UBadge color="neutral" variant="soft" class="rounded-md">
          {{ collectionsData?.pagination?.total ?? collections.length }} рубрик
        </UBadge>
      </div>

      <div v-if="collections.length" class="grid gap-3 p-3 md:grid-cols-2 2xl:grid-cols-3">
        <article v-for="collection in collections" :key="collection.id"
          class="group overflow-hidden rounded-[1.5rem] bg-white shadow-[0_18px_50px_rgba(24,24,27,0.08)] ring-1 ring-zinc-200/80 transition hover:-translate-y-0.5 hover:shadow-[0_24px_70px_rgba(24,24,27,0.12)]">
          <div class="relative min-h-56 overflow-hidden bg-zinc-100">
            <img :src="collection.image" :alt="collection.title"
              class="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105">
            <div class="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,9,11,0.04),rgba(9,9,11,0.72))]" />
            <div class="absolute left-4 top-4 flex flex-wrap gap-2">
              <AdminStatusBadge type="boolean" :value="collection.isActive" />
              <UBadge color="neutral" variant="soft" class="rounded-full bg-white/90">
                Порядок {{ collection.sortOrder }}
              </UBadge>
            </div>
            <div class="absolute inset-x-0 bottom-0 p-4 text-white">
              <h2 class="line-clamp-2 text-2xl font-semibold tracking-normal">
                {{ collection.title }}
              </h2>
              <p class="mt-2 line-clamp-2 text-sm leading-6 text-white/78">
                {{ collection.description }}
              </p>
            </div>
          </div>

          <div class="grid gap-4 p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="rounded-2xl bg-[#f9fafb] px-3 py-2 text-sm font-semibold text-zinc-700">
                {{ collection._count.productCollectionItems }} товаров
              </div>
              <div class="flex gap-2">
                <UButton color="neutral" variant="ghost" icon="i-lucide-pencil" square
                  class="admin-touch-icon rounded-full bg-[#f9fafb] text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"
                  aria-label="Редактировать рубрику" @click="openEdit(collection.id)" />
                <UButton color="error" variant="ghost" icon="i-lucide-trash-2" square
                  class="admin-touch-icon rounded-full" aria-label="Удалить рубрику"
                  @click="deleteCollection(collection)" />
              </div>
            </div>
          </div>
        </article>
      </div>

      <AdminEmptyState v-if="!collections.length && !pending" title="Рубрики не найдены"
        description="Создайте первую рубрику, чтобы показать промо-блок над каталогом.">
        <template #icon>
          <Images class="size-6" />
        </template>
        <template #actions>
          <UButton color="primary" size="lg" class="h-11 rounded-full px-4" @click="openCreate">
            Добавить рубрику
          </UButton>
        </template>
      </AdminEmptyState>

      <AdminPagination v-if="collectionsData?.pagination" :pagination="collectionsData.pagination" :loading="pending"
        @update:page="page = $event" />
    </section>

    <UModal v-model:open="editorOpen" :ui="editorModalUi">
      <template #header>
        <div class="flex min-w-0 items-start gap-4">
          <div class="grid size-12 shrink-0 place-items-center rounded-2xl bg-(--admin-accent) text-white shadow-lg shadow-orange-950/15">
            <Images class="size-6" />
          </div>
          <div class="min-w-0">
            <p class="text-xs font-semibold uppercase text-(--admin-accent-strong)">Рубрика каталога</p>
            <h2 class="mt-1 truncate text-xl font-semibold tracking-normal text-zinc-950 sm:text-2xl">
              {{ editorTitle }}
            </h2>
            <p class="mt-1 max-w-3xl text-sm leading-6 text-zinc-500">
              Изображение, описание и товары для публичного hero-блока.
            </p>
          </div>
        </div>
      </template>

      <template #body>
        <div v-if="loadingDetails" class="grid min-h-96 place-items-center bg-[#f9fafb]">
          <div class="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-zinc-500 shadow-sm shadow-zinc-950/5">
            <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin" />
            Загружаю рубрику
          </div>
        </div>

        <form v-else id="collection-editor-form"
          class="grid gap-5 bg-[#f9fafb] p-4 sm:p-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]"
          @submit.prevent="saveCollection">
          <section class="space-y-5 rounded-3xl bg-white p-4 shadow-sm shadow-zinc-950/5 ring-1 ring-zinc-200/70 sm:p-5">
            <div class="flex items-start gap-3">
              <span class="grid size-10 shrink-0 place-items-center rounded-2xl bg-(--admin-accent-soft) text-(--admin-accent-strong)">
                <UIcon name="i-lucide-file-pen-line" class="size-5" />
              </span>
              <div>
                <h3 class="text-lg font-semibold text-zinc-950">Данные рубрики</h3>
                <p class="mt-1 text-sm leading-6 text-zinc-500">
                  Эти данные попадут в крупный баннер над фильтрами каталога.
                </p>
              </div>
            </div>

            <div class="grid gap-4">
              <UFormField label="Название" required :error="fieldErrors.title">
                <UInput v-model="form.title" class="w-full rounded-2xl bg-[#f9fafb] shadow-inner shadow-zinc-950/5"
                  size="xl" variant="none" placeholder="Например, Всё для сезонного ТО" :ui="inputUi"
                  @update:model-value="fieldErrors.title = undefined" />
              </UFormField>

              <UFormField label="Описание" required :error="fieldErrors.description">
                <UTextarea v-model="form.description" class="w-full rounded-2xl bg-[#f9fafb] shadow-inner shadow-zinc-950/5"
                  :rows="4" autoresize variant="none" placeholder="Коротко объясните, что внутри подборки"
                  :ui="{ base: 'rounded-2xl bg-transparent font-medium text-zinc-900' }"
                  @update:model-value="fieldErrors.description = undefined" />
              </UFormField>

              <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
                <UFormField label="Порядок" required :error="fieldErrors.sortOrder">
                  <UInput v-model.number="form.sortOrder"
                    class="w-full rounded-2xl bg-[#f9fafb] shadow-inner shadow-zinc-950/5" size="xl"
                    variant="none" type="number" min="0" step="1" :ui="inputUi"
                    @update:model-value="fieldErrors.sortOrder = undefined" />
                </UFormField>
                <label class="flex min-h-20 items-center justify-between gap-3 rounded-2xl bg-[#f9fafb] p-3 shadow-inner shadow-zinc-950/5">
                  <span>
                    <span class="block text-xs font-semibold uppercase text-zinc-400">Активна</span>
                    <span class="mt-1 block text-sm text-zinc-600">На сайте</span>
                  </span>
                  <USwitch v-model="form.isActive" color="primary" />
                </label>
              </div>

              <UFormField label="Изображение" required :error="fieldErrors.image">
                <div class="grid gap-3">
                  <div class="overflow-hidden rounded-2xl bg-[#f3f4f6] shadow-inner shadow-zinc-950/5">
                    <img v-if="form.image" :src="form.image" alt=""
                      class="aspect-[16/7] w-full object-cover">
                    <div v-else class="grid aspect-[16/7] place-items-center text-zinc-400">
                      <Images class="size-12" />
                    </div>
                  </div>
                  <div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <UInput v-model="form.image" class="w-full rounded-2xl bg-[#f9fafb] shadow-inner shadow-zinc-950/5"
                      size="lg" variant="none" placeholder="/uploads/banner.webp или https://..."
                      :ui="inputUi" @update:model-value="fieldErrors.image = undefined" />
                    <input ref="imageInput" class="hidden" type="file" accept="image/png,image/jpeg,image/webp,image/gif"
                      @change="uploadImage">
                    <UButton color="neutral" variant="outline" type="button" size="lg"
                      class="min-h-11 justify-center rounded-full px-5" :loading="uploadingImage"
                      @click="openImagePicker">
                      <Upload class="size-4" />
                      Загрузить
                    </UButton>
                  </div>
                </div>
              </UFormField>
            </div>
          </section>

          <section class="space-y-5 rounded-3xl bg-white p-4 shadow-sm shadow-zinc-950/5 ring-1 ring-zinc-200/70 sm:p-5">
            <div class="flex items-start gap-3">
              <span class="grid size-10 shrink-0 place-items-center rounded-2xl bg-orange-50 text-orange-700">
                <UIcon name="i-lucide-package-search" class="size-5" />
              </span>
              <div>
                <h3 class="text-lg font-semibold text-zinc-950">Товары рубрики</h3>
                <p class="mt-1 text-sm leading-6 text-zinc-500">
                  Выберите товары, которые должны отображаться при клике по рубрике.
                </p>
              </div>
            </div>

            <UAlert v-if="fieldErrors.productIds" color="error" variant="soft" class="rounded-2xl"
              :description="fieldErrors.productIds" />

            <div class="grid gap-4">
              <div class="grid gap-3 rounded-2xl bg-[#f9fafb] p-3 shadow-inner shadow-zinc-950/5">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p class="text-sm font-semibold text-zinc-950">
                      Выбрано: {{ selectedProductIds.length }}
                    </p>
                    <p class="mt-1 text-xs text-zinc-500">
                      Товар добавится в рубрику сразу после выбора.
                    </p>
                  </div>
                  <UButton v-if="selectedProductIds.length" color="neutral" variant="ghost" size="sm"
                    class="rounded-full text-zinc-500" @click="clearSelectedProducts">
                    Очистить список
                  </UButton>
                </div>

                <UFormField label="Найти и добавить товар">
                  <USelectMenu :model-value="productToAddId" class="w-full rounded-2xl bg-white shadow-sm shadow-zinc-950/5"
                    size="lg" color="neutral" variant="none" placeholder="Название или артикул товара"
                    :items="availableProductSelectItems" value-key="id" label-key="label"
                    :filter-fields="['name', 'article', 'label']" :search-input="{ placeholder: 'Поиск товара' }"
                    :content="productSelectContent" :virtualize="{ estimateSize: 56 }" :loading="productOptionsPending"
                    :ui="productSelectUi" @update:model-value="addSelectedProduct">
                    <template #leading>
                      <Search class="size-4 text-zinc-400" />
                    </template>
                    <template #empty>
                      <span class="block px-3 py-6 text-center text-sm text-zinc-500">
                        Все доступные товары уже выбраны
                      </span>
                    </template>
                  </USelectMenu>
                </UFormField>
              </div>

              <div v-if="selectedProducts.length" class="grid gap-2">
                <article v-for="(product, index) in selectedProducts" :key="product.id"
                  class="grid grid-cols-[2rem_3.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-[#f9fafb] p-2 shadow-inner shadow-zinc-950/5 sm:grid-cols-[2.5rem_4rem_minmax(0,1fr)_auto]">
                  <span class="grid size-8 place-items-center rounded-xl bg-white text-sm font-semibold text-zinc-500 shadow-sm shadow-zinc-950/5 sm:size-10">
                    {{ index + 1 }}
                  </span>
                  <img :src="product.mainImage || '/favicon.ico'" :alt="product.name"
                    class="aspect-square w-14 rounded-xl object-cover sm:w-16">
                  <div class="min-w-0">
                    <p class="line-clamp-1 text-sm font-semibold text-zinc-950">
                      {{ product.name }}
                    </p>
                    <p class="mt-0.5 line-clamp-1 text-xs text-zinc-500">
                      {{ product.article }} · {{ formatCurrency(product.currentPrice) }}
                    </p>
                  </div>
                  <UButton color="error" variant="ghost" icon="i-lucide-x" square
                    class="admin-touch-icon rounded-full" aria-label="Убрать товар из рубрики"
                    @click="removeSelectedProduct(product.id)" />
                </article>
              </div>

              <div v-else
                class="grid min-h-40 place-items-center rounded-2xl border border-dashed border-zinc-300 bg-[#f9fafb] px-4 text-center text-sm text-zinc-500">
                <span class="grid gap-3">
                  <span class="mx-auto grid size-11 place-items-center rounded-full bg-orange-50 text-orange-700">
                    <Plus class="size-5" />
                  </span>
                  <span>Выберите первый товар через поиск выше</span>
                </span>
              </div>
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
          <UButton color="primary" size="lg" type="submit" form="collection-editor-form"
            class="min-h-12 justify-center rounded-full px-6 shadow-lg shadow-orange-950/10" :loading="submitting">
            <Save class="size-4" />
            Сохранить рубрику
          </UButton>
        </div>
      </template>
    </UModal>

    <AdminConfirmModal v-model:open="confirmOpen" v-bind="confirmOptions" :loading="confirmLoading"
      @confirm="runConfirmedAction" />
  </div>
</template>

<script setup lang="ts">
import { Images, Plus, Save, Search, Upload } from "@lucide/vue";
import { watchDebounced } from "@vueuse/core";
import { toast } from "vue-sonner";
import {
  buildQuery,
  formatCurrency,
  formatNumber,
  getErrorMessage
} from "~~/app/shared/lib/adminFormatters";
import { adminFetch } from "~~/app/shared/lib/adminFetch";
import { useAdminConfirmation } from "~~/app/shared/lib/useAdminConfirmation";
import { clearFieldErrors, getZodFieldErrors, replaceFieldErrors } from "~~/app/shared/lib/zodValidation";
import type {
  PaginatedResponse,
  ProductCollectionDetails,
  ProductCollectionListItem,
  ProductListItem
} from "~~/app/shared/types/admin";
import { collectionInputSchema } from "~~/shared/schemas/admin/collections/upsertCollection";

definePageMeta({
  layout: "admin"
});

type ProductSelectItem = ProductListItem & {
  label: string;
  description: string;
};
type ProductSelectValue = number | ProductSelectItem | undefined;

const page = ref(1);
const search = ref("");
const debouncedSearch = ref("");
const status = ref<"all" | "true" | "false">("all");
const editorOpen = ref(false);
const selectedCollectionId = ref<number | null>(null);
const loadingDetails = ref(false);
const submitting = ref(false);
const uploadingImage = ref(false);
const imageInput = ref<HTMLInputElement | null>(null);
const productToAddId = ref<number | undefined>();
const selectedProductIds = ref<number[]>([]);
const productSnapshots = ref<ProductListItem[]>([]);
const fieldErrors = reactive<Record<string, string | undefined>>({});
const form = reactive({
  title: "",
  description: "",
  image: "",
  sortOrder: 0,
  isActive: true
});
const {
  confirmLoading,
  confirmOpen,
  confirmOptions,
  requestConfirm,
  runConfirmedAction
} = useAdminConfirmation();

watchDebounced(
  search,
  (value) => {
    debouncedSearch.value = value;
    page.value = 1;
  },
  { debounce: 350, maxWait: 1000 }
);

watch(status, () => {
  page.value = 1;
});

const statusItems = [
  { label: "Все", value: "all" },
  { label: "Активные", value: "true" },
  { label: "Выключенные", value: "false" }
];
const inputUi = {
  base: "h-12 rounded-2xl bg-transparent font-medium text-zinc-900"
};
const selectUi = {
  base: "h-12 rounded-2xl bg-transparent font-medium text-zinc-700",
  content: "rounded-2xl bg-white shadow-xl shadow-zinc-950/10 ring-0",
  viewport: "p-1"
};
const productSelectUi = {
  base: "min-h-12 rounded-2xl bg-transparent font-medium text-zinc-800",
  content: "max-h-80 rounded-2xl bg-white shadow-xl shadow-zinc-950/10 ring-0",
  viewport: "p-1"
};
const productSelectContent = {
  side: "bottom" as const,
  align: "start" as const,
  sideOffset: 8,
  collisionPadding: 12
};
const editorModalUi = {
  content: "max-h-[calc(100dvh-2rem)] max-w-7xl overflow-hidden rounded-3xl bg-white shadow-2xl shadow-zinc-950/20 ring-0 sm:max-h-[calc(100dvh-4rem)]",
  header: "shrink-0 border-b border-zinc-100 bg-white/95 px-4 py-4 backdrop-blur sm:px-6",
  body: "min-h-0 flex-1 overflow-y-auto overscroll-contain p-0",
  footer: "shrink-0 border-t border-zinc-100 bg-white/95 px-4 py-4 sm:px-6"
};

const collectionsQuery = computed(() => buildQuery({
  page: page.value,
  search: debouncedSearch.value,
  isActive: status.value === "all" ? null : status.value
}));

const { data: collectionsData, pending, error, refresh } = await useAsyncData(
  "admin-product-collections",
  () => adminFetch<PaginatedResponse<ProductCollectionListItem>>(`/api/admin/collections${collectionsQuery.value}`),
  { watch: [collectionsQuery] }
);
const { data: productOptionsData, pending: productOptionsPending } = await useAsyncData(
  "admin-collection-product-options",
  () => adminFetch<{ items: ProductListItem[] }>("/api/admin/products/options")
);

const collections = computed(() => collectionsData.value?.items ?? []);
const productOptions = computed(() => {
  const products = new Map<number, ProductListItem>();

  for (const product of productOptionsData.value?.items ?? []) {
    products.set(product.id, product);
  }

  for (const product of productSnapshots.value) {
    products.set(product.id, product);
  }

  return Array.from(products.values());
});
const productById = computed(() => new Map(productOptions.value.map((product) => [product.id, product])));
const selectedProductIdSet = computed(() => new Set(selectedProductIds.value));
const selectedProducts = computed(() =>
  selectedProductIds.value
    .map((productId) => productById.value.get(productId))
    .filter(isProductListItem)
);
const availableProductSelectItems = computed(() =>
  productOptions.value
    .filter((product) => !selectedProductIdSet.value.has(product.id))
    .map(toProductSelectItem)
);
const editorTitle = computed(() => selectedCollectionId.value ? "Редактировать рубрику" : "Новая рубрика");
const selectedStatusLabel = computed(() => {
  if (status.value === "all") {
    return "";
  }

  return statusItems.find((item) => item.value === status.value)?.label ?? "";
});
const hasAnyFilter = computed(() => search.value.trim() !== "" || status.value !== "all");
const collectionsStatusText = computed(() => {
  const pagination = collectionsData.value?.pagination;

  if (!pagination) {
    return pending.value ? "Загружаем рубрики..." : "Нет данных по рубрикам";
  }

  if (pagination.total === 0) {
    return "По текущим фильтрам рубрики не найдены";
  }

  const start = (pagination.page - 1) * pagination.limit + 1;
  const end = Math.min(pagination.page * pagination.limit, pagination.total);

  return `Показаны ${formatNumber(start)}-${formatNumber(end)} из ${formatNumber(pagination.total)} рубрик`;
});

function resetFilters() {
  search.value = "";
  debouncedSearch.value = "";
  status.value = "all";
  page.value = 1;
}

function resetEditor() {
  selectedCollectionId.value = null;
  form.title = "";
  form.description = "";
  form.image = "";
  form.sortOrder = 0;
  form.isActive = true;
  productToAddId.value = undefined;
  selectedProductIds.value = [];
  productSnapshots.value = [];
  clearFieldErrors(fieldErrors);
}

function closeEditor() {
  editorOpen.value = false;
}

function openCreate() {
  resetEditor();
  editorOpen.value = true;
}

function openEdit(collectionId: number) {
  resetEditor();
  selectedCollectionId.value = collectionId;
  editorOpen.value = true;
  void loadCollection(collectionId);
}

async function loadCollection(collectionId: number) {
  loadingDetails.value = true;

  try {
    const collection = await adminFetch<ProductCollectionDetails>(`/api/admin/collections/${collectionId}`);
    form.title = collection.title;
    form.description = collection.description;
    form.image = collection.image;
    form.sortOrder = collection.sortOrder;
    form.isActive = collection.isActive;
    setSelectedProducts(collection.products);
  } catch (err) {
    toast.error(getErrorMessage(err, "Не удалось загрузить рубрику"));
    editorOpen.value = false;
  } finally {
    loadingDetails.value = false;
  }
}

function setSelectedProducts(products: ProductListItem[]) {
  productSnapshots.value = products;
  selectedProductIds.value = products.map((product) => product.id);
}

function addSelectedProduct(value: ProductSelectValue) {
  const productId = typeof value === "number" ? value : value?.id;

  if (typeof productId !== "number" || selectedProductIdSet.value.has(productId)) {
    productToAddId.value = undefined;
    return;
  }

  selectedProductIds.value = [...selectedProductIds.value, productId];
  productToAddId.value = undefined;
  fieldErrors.productIds = undefined;
}

function removeSelectedProduct(productId: number) {
  selectedProductIds.value = selectedProductIds.value.filter((selectedProductId) => selectedProductId !== productId);
  fieldErrors.productIds = undefined;
}

function clearSelectedProducts() {
  selectedProductIds.value = [];
  fieldErrors.productIds = undefined;
}

function toProductSelectItem(product: ProductListItem): ProductSelectItem {
  return {
    ...product,
    label: `${product.name} · ${product.article}`,
    description: formatCurrency(product.currentPrice)
  };
}

function isProductListItem(product: ProductListItem | undefined): product is ProductListItem {
  return Boolean(product);
}

function openImagePicker() {
  if (!uploadingImage.value) {
    imageInput.value?.click();
  }
}

async function uploadImage(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file) {
    return;
  }

  uploadingImage.value = true;

  try {
    const formData = new FormData();
    formData.set("file", file);
    const result = await adminFetch<{ url: string }>("/api/admin/upload", {
      method: "POST",
      body: formData
    });
    form.image = result.url;
    fieldErrors.image = undefined;
    toast.success("Изображение рубрики загружено");
  } catch (err) {
    toast.error(getErrorMessage(err, "Не удалось загрузить изображение"));
  } finally {
    uploadingImage.value = false;
    input.value = "";
  }
}

function buildPayload() {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    image: form.image.trim(),
    isActive: form.isActive,
    sortOrder: form.sortOrder,
    productIds: selectedProductIds.value
  };
}

async function saveCollection() {
  if (submitting.value || loadingDetails.value) {
    return;
  }

  const parsed = collectionInputSchema.safeParse(buildPayload());

  if (!parsed.success) {
    replaceFieldErrors(fieldErrors, getZodFieldErrors(parsed.error));
    toast.error("Проверьте поля рубрики");
    return;
  }

  clearFieldErrors(fieldErrors);
  submitting.value = true;

  try {
    if (selectedCollectionId.value) {
      await adminFetch(`/api/admin/collections/update/${selectedCollectionId.value}`, {
        method: "POST",
        body: parsed.data
      });
      toast.success("Рубрика обновлена");
    } else {
      await adminFetch("/api/admin/collections", {
        method: "POST",
        body: parsed.data
      });
      toast.success("Рубрика создана");
    }

    editorOpen.value = false;
    await refresh();
    clearNuxtData("shop-product-collections");
  } catch (err) {
    toast.error(getErrorMessage(err, "Не удалось сохранить рубрику"));
  } finally {
    submitting.value = false;
  }
}

function deleteCollection(collection: ProductCollectionListItem) {
  requestConfirm({
    title: "Удалить рубрику",
    description: "Действие нельзя отменить",
    message: `Удалить рубрику "${collection.title}"?`,
    hint: "Изображение рубрики будет удалено из хранилища, если оно было загружено через админку.",
    verificationLabel: "Введите название рубрики",
    verificationPlaceholder: collection.title,
    verificationText: collection.title,
    confirmLabel: "Удалить",
    color: "error"
  }, async () => {
    try {
      await adminFetch(`/api/admin/collections/delete/${collection.id}`, {
        method: "POST"
      });
      toast.success("Рубрика удалена");
      await refresh();
      clearNuxtData("shop-product-collections");
    } catch (err) {
      toast.error(getErrorMessage(err, "Не удалось удалить рубрику"));
    }
  });
}
</script>

<style scoped>
.collections-admin-page :deep(.admin-card) {
  border: 0;
  border-radius: 1rem;
  background: #ffffff;
  box-shadow: 0 1px 3px rgb(24 24 27 / 5%);
}

@media (min-width: 640px) {
  .collections-admin-page :deep(.admin-card) {
    border-radius: 1.5rem;
  }
}
</style>
