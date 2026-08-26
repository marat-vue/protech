<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <ClientOnly>
      <Toaster rich-colors close-button position="top-right" />
    </ClientOnly>
  </UApp>
</template>

<script setup lang="ts">
import { siteConfig } from "~~/shared/config/site";

const siteName = siteConfig.name;
const siteDescription = siteConfig.description;

useHead({
  titleTemplate: (title) => title && title !== siteName ? `${title} · ${siteName}` : siteName,
});

useSeoMeta({
  title: siteName,
  description: siteDescription,
  ogTitle: siteName,
  ogDescription: siteDescription,
  ogImage: "/logo.png",
  ogImageAlt: "Логотип ПроТех76",
  ogLocale: "ru_RU",
  ogSiteName: siteName,
  twitterCard: "summary_large_image",
  robots: "index, follow, max-image-preview:large"
});

if (import.meta.server) {
  defineOgImage("NuxtSeoSatori", {
    title: siteName,
    description: siteDescription
  }, [
    { key: "og", width: 1200, height: 630 },
    { key: "whatsapp", width: 800, height: 800 }
  ]);
}
</script>
