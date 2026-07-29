<template>
  <nav
    aria-label="Мобильная навигация"
    class="fixed inset-x-0 bottom-0 z-[45] border-t border-zinc-200/80 bg-white/95 shadow-[0_-12px_40px_rgba(24,24,27,0.10)] backdrop-blur-xl md:hidden"
  >
    <div
      class="mx-auto grid max-w-lg grid-cols-5 px-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5"
    >
      <NuxtLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="group flex min-h-15 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-0.5 text-[11px] font-medium leading-none transition-colors"
        :class="isActive(item) ? 'text-(--shop-accent-strong)' : 'text-zinc-500'"
        :aria-current="isActive(item) ? 'page' : undefined"
      >
        <span
          class="relative grid size-8 place-items-center rounded-xl transition-colors"
          :class="isActive(item) ? 'bg-(--shop-accent-muted) text-(--shop-accent-strong)' : 'text-zinc-500 group-hover:bg-zinc-100 group-hover:text-zinc-800'"
        >
          <UIcon :name="item.icon" class="size-5" />
          <span
            v-if="item.count"
            class="absolute -right-2 -top-1 grid min-w-4.5 place-items-center rounded-full bg-zinc-950 px-1 py-0.5 text-[9px] font-bold leading-none text-white ring-2 ring-white"
          >
            {{ item.count > 99 ? "99+" : item.count }}
          </span>
        </span>
        <span class="block w-full truncate text-center">{{ item.label }}</span>
      </NuxtLink>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { useCartStore } from "~~/app/stores/cart";
import { useFavoritesStore } from "~~/app/stores/favorites";
import { useMessageNotificationsStore } from "~~/app/stores/messageNotifications";

type MobileNavItem = {
  count?: number;
  icon: string;
  label: string;
  match: (path: string) => boolean;
  to: string;
};

const route = useRoute();
const cart = useCartStore();
const favorites = useFavoritesStore();
const messageNotifications = useMessageNotificationsStore();

const navItems = computed<MobileNavItem[]>(() => [
  {
    icon: "i-lucide-layout-grid",
    label: "Каталог",
    match: (path) => path === "/" || path.startsWith("/product"),
    to: "/"
  },
  {
    count: cart.totalItems,
    icon: "i-lucide-shopping-cart",
    label: "Корзина",
    match: (path) => path.startsWith("/cart") || path.startsWith("/checkout"),
    to: "/cart"
  },
  {
    count: favorites.count,
    icon: "i-lucide-heart",
    label: "Избранное",
    match: (path) => path.startsWith("/favorites"),
    to: "/favorites"
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
  }
]);

function isActive(item: MobileNavItem) {
  return item.match(route.path);
}
</script>
