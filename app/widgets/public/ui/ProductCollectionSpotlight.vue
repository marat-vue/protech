<template>
  <section
    v-if="collections.length"
    class="collection-spotlight relative left-1/2 mb-5 w-screen -translate-x-1/2 sm:left-auto sm:w-auto sm:translate-x-0"
  >
    <div
      class="relative overflow-hidden bg-zinc-950 text-white shadow-[0_24px_90px_rgba(15,23,42,0.16)] sm:rounded-3xl"
      @focusin="pauseAutoplay"
      @focusout="queueAutoplay"
    >
      <div
        ref="trackRef"
        class="collection-spotlight__track flex snap-x snap-mandatory overflow-x-auto scroll-smooth overscroll-x-contain"
        @scroll.passive="handleScroll"
        @pointerdown="pauseAutoplay"
        @pointerup="queueAutoplay"
        @pointercancel="queueAutoplay"
        @touchend.passive="queueAutoplay"
      >
        <article
          v-for="collection in collections"
          :key="collection.id"
          class="relative min-h-[27rem] w-full shrink-0 snap-center overflow-hidden sm:min-h-[22rem]"
        >
          <img
            :src="collection.image"
            :alt="collection.title"
            class="absolute inset-0 h-full w-full object-cover opacity-60"
          >
          <div class="absolute inset-0 bg-[linear-gradient(90deg,rgba(9,9,11,0.86),rgba(9,9,11,0.48)_54%,rgba(9,9,11,0.18))]" />

          <div class="relative flex min-h-[27rem] flex-col justify-end p-5 pb-20 sm:min-h-[22rem] sm:p-7 sm:pb-24 lg:p-9">
            <p class="text-sm font-semibold uppercase text-yellow-200">
              Рубрика каталога
            </p>
            <h2 class="mt-3 max-w-4xl text-3xl font-semibold tracking-normal sm:text-5xl">
              {{ collection.title }}
            </h2>
            <p class="mt-4 max-w-2xl text-sm leading-6 text-white/78 sm:text-base">
              {{ collection.description }}
            </p>

            <div class="mt-6 flex flex-wrap gap-2">
              <UButton
                color="primary"
                size="lg"
                icon="i-lucide-sparkles"
                class="min-h-12 rounded-full px-5 shadow-lg shadow-yellow-950/20"
                @click="selectCollection(collection.id)"
              >
                Показать товары
              </UButton>
              <UButton
                v-if="selectedCollectionId === collection.id"
                color="neutral"
                variant="soft"
                size="lg"
                icon="i-lucide-rotate-ccw"
                class="min-h-12 rounded-full bg-white/12 px-5 text-white ring-1 ring-white/10 hover:bg-white/18"
                @click="selectCollection(null)"
              >
                Все товары
              </UButton>
              <span class="inline-flex min-h-12 items-center rounded-full bg-white/12 px-4 text-sm font-semibold text-white/82 ring-1 ring-white/10">
                {{ collection.productsCount }} товаров
              </span>
            </div>
          </div>
        </article>
      </div>

      <div v-if="collections.length > 1" class="pointer-events-none absolute right-4 top-4 hidden gap-2 sm:flex lg:right-5 lg:top-5">
        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-chevron-left"
          square
          class="pointer-events-auto size-11 justify-center rounded-full bg-white/12 text-white ring-1 ring-white/10 backdrop-blur hover:bg-white/20"
          aria-label="Предыдущая рубрика"
          @click="showPrevious"
        />
        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-chevron-right"
          square
          class="pointer-events-auto size-11 justify-center rounded-full bg-white/12 text-white ring-1 ring-white/10 backdrop-blur hover:bg-white/20"
          aria-label="Следующая рубрика"
          @click="showNext"
        />
      </div>

      <div
        v-if="collections.length > 1"
        class="absolute inset-x-0 bottom-4 flex items-center justify-center gap-2 px-4 sm:bottom-5"
      >
        <button
          v-for="(collection, index) in collections"
          :key="collection.id"
          type="button"
          class="h-2.5 rounded-full bg-white/38 transition-all hover:bg-white/70"
          :class="index === activeIndex ? 'w-8 bg-yellow-300' : 'w-2.5'"
          :aria-label="`Показать рубрику ${collection.title}`"
          @click="showSlide(index)"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { ProductCollection } from "~~/app/shared/types/shop";

const props = defineProps<{
  collections: ProductCollection[];
  selectedCollectionId: number | null;
}>();

const emit = defineEmits<{
  select: [collectionId: number | null];
}>();

const trackRef = ref<HTMLElement | null>(null);
const activeIndex = ref(0);
let autoplayTimer: number | null = null;
let scrollFrame = 0;

const selectedCollectionIndex = computed(() =>
  props.collections.findIndex((collection) => collection.id === props.selectedCollectionId)
);

watch(selectedCollectionIndex, (index) => {
  if (index >= 0) {
    scrollToIndex(index);
  }
});

watch(
  () => props.collections.length,
  (length) => {
    if (activeIndex.value >= length) {
      scrollToIndex(0, "auto");
    }

    queueAutoplay();
  }
);

onMounted(() => {
  if (selectedCollectionIndex.value >= 0) {
    scrollToIndex(selectedCollectionIndex.value, "auto");
  }

  queueAutoplay();
});

onBeforeUnmount(() => {
  clearAutoplay();

  if (scrollFrame) {
    cancelAnimationFrame(scrollFrame);
  }
});

function normalizeIndex(index: number) {
  const length = props.collections.length;

  if (!length) {
    return 0;
  }

  return (index + length) % length;
}

function scrollToIndex(index: number, behavior: ScrollBehavior = "smooth") {
  const normalizedIndex = normalizeIndex(index);
  activeIndex.value = normalizedIndex;

  const track = trackRef.value;

  if (!track) {
    return;
  }

  track.scrollTo({
    left: track.clientWidth * normalizedIndex,
    behavior
  });
}

function showSlide(index: number) {
  scrollToIndex(index);
  queueAutoplay();
}

function showPrevious() {
  scrollToIndex(activeIndex.value - 1);
  queueAutoplay();
}

function showNext() {
  scrollToIndex(activeIndex.value + 1);
  queueAutoplay();
}

function selectCollection(collectionId: number | null) {
  emit("select", collectionId);
  queueAutoplay();
}

function handleScroll() {
  if (scrollFrame) {
    cancelAnimationFrame(scrollFrame);
  }

  scrollFrame = requestAnimationFrame(() => {
    const track = trackRef.value;

    if (!track || track.clientWidth === 0) {
      return;
    }

    activeIndex.value = normalizeIndex(Math.round(track.scrollLeft / track.clientWidth));
  });
}

function clearAutoplay() {
  if (!autoplayTimer) {
    return;
  }

  clearTimeout(autoplayTimer);
  autoplayTimer = null;
}

function pauseAutoplay() {
  clearAutoplay();
}

function queueAutoplay() {
  clearAutoplay();

  if (props.collections.length <= 1) {
    return;
  }

  autoplayTimer = window.setTimeout(() => {
    scrollToIndex(activeIndex.value + 1);
    queueAutoplay();
  }, 5000);
}
</script>

<style scoped>
.collection-spotlight__track {
  scrollbar-width: none;
}

.collection-spotlight__track::-webkit-scrollbar {
  display: none;
}
</style>
