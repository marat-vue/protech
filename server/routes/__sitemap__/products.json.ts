import { getRequestURL, type H3Event } from "h3";

export default defineEventHandler(async (event) => {
  const siteUrl = getPublicSiteUrl(event);
  const products = await prisma.product.findMany({
    orderBy: [
      { updatedAt: "desc" },
      { id: "asc" }
    ],
    where: {
      isActive: true
    },
    select: {
      id: true,
      name: true,
      description: true,
      mainImage: true,
      updatedAt: true,
      productImages: {
        select: {
          url: true
        }
      }
    }
  });

  return products.map((product) => {
    const imageUrls = [
      product.mainImage,
      ...product.productImages.map((image) => image.url)
    ]
      .map((url) => normalizePublicUrl(url, siteUrl))
      .filter((url): url is string => Boolean(url));

    return {
      loc: `/product/${product.id}`,
      lastmod: product.updatedAt.toISOString(),
      changefreq: "weekly",
      priority: 0.8,
      images: imageUrls.map((url) => ({
        loc: url,
        title: product.name,
        caption: product.description?.slice(0, 180)
      }))
    };
  });
});

function getPublicSiteUrl(event: H3Event) {
  const configuredUrl = process.env.NUXT_SITE_URL ?? process.env.NUXT_PUBLIC_SITE_URL ?? process.env.NUXT_PUBLIC_APP_URL;

  if (configuredUrl && !/localhost|127\.0\.0\.1/.test(configuredUrl)) {
    return configuredUrl.replace(/\/+$/, "");
  }

  return getRequestURL(event).origin.replace(/\/+$/, "");
}

function normalizePublicUrl(url: string | null | undefined, siteUrl: string) {
  if (!url) {
    return null;
  }

  try {
    return new URL(url, siteUrl).toString();
  } catch {
    return null;
  }
}
