<template>
  <nav
    aria-label="Категории товаров"
    class="mb-3 border-y border-zinc-200/80 bg-white/90 shadow-sm shadow-zinc-950/5 sm:rounded-2xl sm:border"
  >
    <div
      ref="trackRef"
      class="category-track flex w-full items-center gap-7 overflow-x-auto overscroll-x-contain px-4 sm:gap-8 sm:px-5"
    >
      <button
        v-for="item in items"
        :key="item.id ?? 'all'"
        :ref="(element) => setCategoryButton(element, item.id)"
        type="button"
        class="relative shrink-0 whitespace-nowrap py-4 text-sm font-medium transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-primary after:transition-transform hover:text-zinc-950"
        :class="item.id === categoryId
          ? 'text-zinc-950 after:scale-x-100'
          : 'text-zinc-600'"
        :aria-pressed="item.id === categoryId"
        @click="categoryId = item.id"
      >
        {{ item.name }}
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import type { ComponentPublicInstance } from "vue";
import type { ProductCatalogCategoryItem } from "~~/app/shared/lib/catalogProductHelpers";

defineProps<{
  items: ProductCatalogCategoryItem[];
}>();

const categoryId = defineModel<number | null>({ required: true });
const trackRef = ref<HTMLElement | null>(null);
const categoryButtons = new Map<number | null, HTMLElement>();

watch(categoryId, async (value) => {
  await nextTick();

  const track = trackRef.value;
  const button = categoryButtons.get(value);

  if (!track || !button) {
    return;
  }

  const trackRect = track.getBoundingClientRect();
  const buttonRect = button.getBoundingClientRect();

  if (buttonRect.left < trackRect.left || buttonRect.right > trackRect.right) {
    button.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest"
    });
  }
});

function setCategoryButton(
  element: Element | ComponentPublicInstance | null,
  categoryId: number | null
) {
  if (element instanceof HTMLElement) {
    categoryButtons.set(categoryId, element);
    return;
  }

  categoryButtons.delete(categoryId);
}
</script>

<style scoped>
.category-track {
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.category-track::-webkit-scrollbar {
  display: none;
}
</style>
