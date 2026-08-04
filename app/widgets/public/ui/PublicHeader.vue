<template>
  <header
    class="fixed inset-x-0 top-0 px-2 pt-2 sm:px-4 sm:pt-3"
    :class="mobileOpen ? 'z-[60]' : 'z-40'"
  >
    <div class="mx-auto w-full max-w-370">
      <div
        class="overflow-hidden rounded-[2rem] border border-white/80 bg-white/95 p-2 shadow-[0_18px_70px_rgba(15,23,42,0.12)] backdrop-blur-2xl"
      >
        <div class="flex min-h-16 items-center gap-1.5 sm:gap-2">
          <NuxtLink
            to="/"
            class="group flex shrink-0 items-center gap-2 rounded-[1.4rem] px-1.5 py-1 transition hover:bg-[#f9fafb] sm:gap-3 sm:px-2"
            aria-label="На главную ПроТех76"
          >
            <span
              class="grid size-11 place-items-center overflow-hidden rounded-[1.25rem] shadow-lg shadow-yellow-950/15 transition duration-300 group-hover:rotate-3 group-hover:scale-105"
            >
              <img src="/logo.png" alt="Логотип ПроТех76" class="size-full object-contain">
            </span>
            <span class="min-w-0 leading-tight">
              <span class="brand-wordmark block truncate text-lg font-semibold text-zinc-950 sm:text-lg">
                ПроТех76
              </span>
              <span class="hidden text-[11px] text-zinc-500 lg:block">
                Запчасти для техники Rippa
              </span>
            </span>
          </NuxtLink>

          <form
            class="mx-auto hidden min-w-40 max-w-2xl flex-1 items-center rounded-full bg-[#f3f4f6] p-1 md:flex"
            role="search"
            @submit.prevent="submitSearch"
          >
            <UInput
              v-model="headerSearch"
              icon="i-lucide-search"
              variant="none"
              size="lg"
              placeholder="Найти товар, артикул или бренд"
              aria-label="Поиск по каталогу"
              class="min-w-0 flex-1"
              :ui="searchInputUi"
            />
            <UButton
              color="primary"
              type="submit"
              icon="i-lucide-arrow-right"
              square
              class="!size-10 shrink-0 rounded-full"
              aria-label="Найти"
            />
          </form>

          <div class="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
            <a
              href="tel:+79201309744"
              class="hidden rounded-full px-3 py-2 text-right transition hover:bg-[#f9fafb] 2xl:block"
            >
              <span class="block text-sm font-semibold text-zinc-950">+7 920 130-97-44</span>
              <span class="block text-[11px] text-zinc-500">Ежедневно, 9:00–18:00</span>
            </a>

            <UTooltip text="Заказать звонок">
              <UButton
                color="neutral"
                variant="ghost"
                class="hidden !h-11 shrink-0 rounded-full bg-[#f3f4f6] px-3 text-zinc-700 hover:bg-(--shop-accent-soft) hover:text-(--shop-accent-strong) sm:flex"
                aria-label="Заказать звонок"
                @click="openCallback"
              >
                <UIcon name="i-lucide-phone-call" class="size-5" />
                <span class="hidden xl:inline">Заказать звонок</span>
              </UButton>
            </UTooltip>

            <UTooltip text="Поиск">
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-search"
                square
                class="!size-11 shrink-0 rounded-full bg-[#f3f4f6] text-zinc-700 md:hidden"
                :aria-expanded="mobileSearchOpen"
                aria-controls="mobile-header-search"
                aria-label="Открыть поиск"
                @click="toggleMobileSearch"
              />
            </UTooltip>

            <UTooltip :text="auth.user ? 'Профиль и заказы' : 'Войти в профиль'">
              <UButton
                color="neutral"
                variant="ghost"
                :to="profileLink"
                class="hidden !size-11 shrink-0 justify-center rounded-full bg-[#f3f4f6] p-0 text-zinc-700 min-[360px]:flex"
                :aria-label="auth.user ? 'Профиль и заказы' : 'Войти в профиль'"
              >
                <img
                  v-if="auth.user?.image"
                  :src="auth.user.image"
                  :alt="auth.user.name ?? auth.user.email"
                  class="size-8 rounded-full object-cover"
                >
                <span
                  v-else-if="auth.user"
                  class="grid size-8 place-items-center rounded-full bg-(--shop-accent-muted) text-xs font-bold text-(--shop-accent-strong)"
                >
                  {{ auth.initials }}
                </span>
                <UIcon v-else name="i-lucide-circle-user-round" class="size-5" />
              </UButton>
            </UTooltip>

            <UTooltip text="Корзина">
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-shopping-cart"
                square
                to="/cart"
                class="relative !size-11 shrink-0 rounded-full bg-[#f3f4f6] text-zinc-700"
                aria-label="Корзина"
              >
                <span
                  v-if="cart.totalItems"
                  class="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-zinc-950 px-1 py-0.5 text-[10px] font-bold leading-none text-white ring-2 ring-white"
                >
                  {{ cart.totalItems > 99 ? "99+" : cart.totalItems }}
                </span>
              </UButton>
            </UTooltip>

            <UTooltip text="Открыть меню">
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-menu"
                square
                class="!size-11 shrink-0 rounded-full bg-[#f3f4f6] text-zinc-700 xl:hidden"
                aria-label="Открыть меню"
                @click="openMobileMenu"
              />
            </UTooltip>
          </div>
        </div>

        <div class="hidden items-center gap-3 border-t border-zinc-100 px-2 pb-1 pt-2 xl:flex">
          <nav aria-label="Основная навигация" class="flex min-w-0 flex-1 items-center gap-1">
            <NuxtLink
              v-for="item in navItems"
              :key="item.to"
              :to="item.to"
              class="relative inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium transition hover:bg-[#f3f4f6]"
              :aria-current="isNavActive(item) ? 'page' : undefined"
              :class="isNavActive(item) ? 'bg-(--shop-accent-soft) text-(--shop-accent-strong)' : 'text-zinc-500 hover:text-zinc-950'"
            >
              <UIcon :name="item.icon" class="size-4" />
              {{ item.label }}
              <span
                v-if="item.count"
                class="grid min-w-5 place-items-center rounded-full bg-zinc-950 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white"
              >
                {{ item.count > 99 ? "99+" : item.count }}
              </span>
            </NuxtLink>
          </nav>

          <UButton
            v-if="auth.user"
            color="neutral"
            variant="ghost"
            icon="i-lucide-log-out"
            size="sm"
            class="rounded-full text-zinc-500"
            :loading="auth.pending"
            @click="logout"
          >
            Выйти
          </UButton>
        </div>
      </div>

      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="-translate-y-2 opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="-translate-y-2 opacity-0"
      >
        <form
          v-if="mobileSearchOpen"
          id="mobile-header-search"
          class="mt-2 flex items-center gap-2 rounded-[1.5rem] border border-white/80 bg-white/95 p-2 shadow-xl shadow-zinc-950/10 backdrop-blur-xl md:hidden"
          role="search"
          @submit.prevent="submitSearch"
        >
          <UInput
            v-model="headerSearch"
            icon="i-lucide-search"
            variant="none"
            size="lg"
            placeholder="Что вы ищете?"
            aria-label="Поиск по каталогу"
            autofocus
            class="min-w-0 flex-1 rounded-full bg-[#f3f4f6]"
            :ui="searchInputUi"
          />
          <UButton color="primary" type="submit" icon="i-lucide-search" square class="!size-11 rounded-full" aria-label="Найти" />
        </form>
      </Transition>
    </div>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="mobileOpen" class="fixed inset-0 z-50 xl:hidden">
        <button class="absolute inset-0 bg-zinc-950/45 backdrop-blur-sm" aria-label="Закрыть меню" @click="closeMobileMenu" />

        <aside
          ref="mobilePanel"
          aria-labelledby="mobile-menu-title"
          aria-modal="true"
          role="dialog"
          tabindex="-1"
          class="absolute bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-3 right-3 top-3 flex min-h-0 flex-col overflow-hidden rounded-4xl bg-white p-4 shadow-2xl shadow-zinc-950/25 sm:left-auto sm:w-[390px] sm:max-w-[calc(100vw-1.5rem)] md:bottom-3"
          @keydown.esc.prevent="closeMobileMenu"
          @keydown.tab="trapMobileFocus"
        >
          <div class="flex items-center justify-between gap-4">
            <NuxtLink to="/" class="flex items-center gap-3 rounded-3xl" aria-label="На главную ПроТех76" @click="closeMobileMenu">
              <span class="grid size-11 place-items-center overflow-hidden rounded-[1.35rem] shadow-xl shadow-yellow-950/15">
                <img src="/logo.png" alt="Логотип ПроТех76" class="size-full object-contain">
              </span>
              <span>
                <span id="mobile-menu-title" class="brand-wordmark block font-semibold text-zinc-950">ПроТех76</span>
                <span class="block text-xs text-zinc-500">Навигация магазина</span>
              </span>
            </NuxtLink>

            <UButton
              color="neutral"
              variant="soft"
              icon="i-lucide-x"
              square
              class="!size-11 shrink-0 rounded-full bg-[#f3f4f6]"
              aria-label="Закрыть меню"
              @click="closeMobileMenu"
            />
          </div>

          <div class="mt-6 min-h-0 flex-1 overflow-y-auto pr-1">
            <div v-auto-animate class="grid gap-2">
              <NuxtLink
                v-for="item in drawerNavItems"
                :key="item.to"
                :to="item.to"
                class="flex items-center justify-between gap-3 rounded-[1.35rem] bg-[#f9fafb] px-4 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
                :aria-current="isNavActive(item) ? 'page' : undefined"
                :class="isNavActive(item) ? 'text-(--shop-accent-strong)' : ''"
                @click="closeMobileMenu"
              >
                <span class="flex items-center gap-3">
                  <span class="grid size-10 place-items-center rounded-full bg-white text-zinc-500 shadow-sm shadow-zinc-950/5">
                    <UIcon :name="item.icon" class="size-5" />
                  </span>
                  {{ item.label }}
                </span>
                <span
                  v-if="item.count"
                  class="grid min-w-6 place-items-center rounded-full bg-zinc-950 px-2 py-0.5 text-xs font-semibold text-white"
                >
                  {{ item.count > 99 ? "99+" : item.count }}
                </span>
              </NuxtLink>
            </div>

            <div class="mt-4 grid grid-cols-2 gap-2">
              <UButton color="primary" icon="i-lucide-phone-call" class="min-h-12 justify-center rounded-full" @click="openCallbackFromMenu">
                Заказать звонок
              </UButton>
              <UButton
                color="neutral"
                variant="soft"
                icon="i-lucide-shopping-cart"
                to="/cart"
                class="min-h-12 justify-center rounded-full"
                @click="closeMobileMenu"
              >
                Корзина
              </UButton>
            </div>
          </div>

          <div class="shrink-0 space-y-3 border-t border-zinc-100 bg-white pt-4">
            <div v-if="auth.user" class="rounded-[1.75rem] bg-[#f9fafb] p-4">
              <p class="text-xs uppercase tracking-[0.2em] text-zinc-400">Аккаунт</p>
              <div class="mt-2 flex min-w-0 items-center gap-3">
                <p class="min-w-0 flex-1 truncate font-semibold text-zinc-950">
                  {{ auth.user.name || auth.user.email }}
                </p>
                <UButton
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-log-out"
                  square
                  class="!size-11 shrink-0 rounded-full"
                  :loading="auth.pending"
                  aria-label="Выйти"
                  @click="logout"
                />
              </div>
            </div>
            <UButton
              v-else
              color="primary"
              icon="i-lucide-user-round"
              block
              to="/auth"
              size="lg"
              class="rounded-full"
              @click="closeMobileMenu"
            >
              Войти или создать аккаунт
            </UButton>
          </div>
        </aside>
      </div>
    </Transition>

    <PublicCallbackRequestModal v-model:open="callbackOpen" />
  </header>
</template>

<script setup lang="ts">
import { toast } from "vue-sonner";
import { useAuthStore } from "~~/app/stores/auth";
import { useCartStore } from "~~/app/stores/cart";
import { useFavoritesStore } from "~~/app/stores/favorites";
import { useMessageNotificationsStore } from "~~/app/stores/messageNotifications";
import { useShopUiStore } from "~~/app/stores/shopUi";

type NavItem = {
  count?: number;
  icon: string;
  label: string;
  match: (path: string) => boolean;
  to: string;
};

const route = useRoute();
const auth = useAuthStore();
const cart = useCartStore();
const favorites = useFavoritesStore();
const messageNotifications = useMessageNotificationsStore();
const shopUi = useShopUiStore();
const callbackOpen = ref(false);
const mobileOpen = ref(false);
const mobileSearchOpen = ref(false);
const mobilePanel = ref<HTMLElement | null>(null);
const headerSearch = ref(shopUi.catalog.search);
let lastFocusedElement: HTMLElement | null = null;

const searchInputUi = {
  base: "h-11 rounded-full bg-transparent text-zinc-900 placeholder:text-zinc-400"
};
const profileLink = computed(() => auth.user ? "/orders" : {
  path: "/auth",
  query: { redirect: route.fullPath }
});
const navItems = computed<NavItem[]>(() => [
  {
    icon: "i-lucide-layout-grid",
    label: "Каталог",
    match: (path) => path === "/" || path.startsWith("/product"),
    to: "/"
  },
  {
    icon: "i-lucide-package-check",
    label: "Заказы",
    match: (path) => path.startsWith("/orders"),
    to: "/orders"
  },
  {
    count: messageNotifications.unreadCount,
    icon: "i-lucide-message-circle",
    label: "Сообщения",
    match: (path) => path.startsWith("/messages"),
    to: "/messages"
  },
  {
    count: favorites.count,
    icon: "i-lucide-heart",
    label: "Избранное",
    match: (path) => path.startsWith("/favorites"),
    to: "/favorites"
  },
  {
    icon: "i-lucide-building-2",
    label: "О компании",
    match: (path) => path.startsWith("/about"),
    to: "/about"
  },
  ...(auth.user?.role === "ADMIN"
    ? [{
      icon: "i-lucide-shield-check",
      label: "Админка",
      match: (path: string) => path.startsWith("/admin"),
      to: "/admin"
    }]
    : [])
]);
const drawerNavItems = computed<NavItem[]>(() => [
  ...navItems.value,
  {
    count: cart.totalItems,
    icon: "i-lucide-shopping-cart",
    label: "Корзина",
    match: (path) => path.startsWith("/cart") || path.startsWith("/checkout"),
    to: "/cart"
  }
]);

watch(
  () => route.fullPath,
  () => {
    mobileOpen.value = false;
    mobileSearchOpen.value = false;
  }
);

watch(
  () => shopUi.catalog.search,
  (value) => {
    if (value !== headerSearch.value) {
      headerSearch.value = value;
    }
  }
);

watch(mobileOpen, (open) => {
  if (!import.meta.client) {
    return;
  }

  document.documentElement.style.overflow = open ? "hidden" : "";

  if (open) {
    lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    nextTick(() => {
      const focusable = getMobileFocusableElements();
      (focusable[0] ?? mobilePanel.value)?.focus();
    });
    return;
  }

  lastFocusedElement?.focus();
});

onBeforeUnmount(() => {
  if (import.meta.client) {
    document.documentElement.style.overflow = "";
  }
});

async function submitSearch() {
  const search = headerSearch.value.trim();
  headerSearch.value = search;
  shopUi.catalog.search = search;
  mobileSearchOpen.value = false;
  await navigateTo({
    path: "/",
    query: search ? { search } : {},
    hash: "#catalog"
  });
}

async function logout() {
  try {
    await auth.logout();
    cart.items = [];
    favorites.clearLocal();
    toast.success("Вы вышли из аккаунта");
    mobileOpen.value = false;

    if (["/cart", "/checkout", "/favorites", "/messages"].includes(route.path) || route.path.startsWith("/orders")) {
      await navigateTo("/");
    }
  } catch {
    toast.error("Не удалось завершить сессию");
  }
}

function isNavActive(item: NavItem) {
  return item.match(route.path);
}

function toggleMobileSearch() {
  mobileSearchOpen.value = !mobileSearchOpen.value;
  mobileOpen.value = false;
}

function openCallback() {
  callbackOpen.value = true;
}

function openMobileMenu() {
  mobileSearchOpen.value = false;
  mobileOpen.value = true;
}

function closeMobileMenu() {
  mobileOpen.value = false;
}

function openCallbackFromMenu() {
  closeMobileMenu();
  nextTick(() => {
    callbackOpen.value = true;
  });
}

function getMobileFocusableElements() {
  if (!mobilePanel.value || !import.meta.client) {
    return [];
  }

  return Array.from(
    mobilePanel.value.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])"
    )
  ).filter((element) =>
    !element.hasAttribute("disabled") &&
    element.tabIndex !== -1 &&
    window.getComputedStyle(element).visibility !== "hidden"
  );
}

function trapMobileFocus(event: KeyboardEvent) {
  if (!mobileOpen.value || event.key !== "Tab") {
    return;
  }

  const focusable = getMobileFocusableElements();

  if (!focusable.length) {
    event.preventDefault();
    mobilePanel.value?.focus();
    return;
  }

  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
</script>
