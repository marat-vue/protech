import { defineNuxtConfig } from "nuxt/config";
import process from "process";

const configuredSiteUrl = process.env.NUXT_SITE_URL ?? process.env.NUXT_PUBLIC_SITE_URL ?? process.env.NUXT_PUBLIC_APP_URL;
const siteUrl = configuredSiteUrl && !/localhost|127\.0\.0\.1/.test(configuredSiteUrl)
  ? configuredSiteUrl.replace(/\/$/, "")
  : undefined;
const siteName = "ПроТех76";
const siteDescription = "Интернет-магазин запчастей, навесного оборудования и комплектующих для мини-экскаваторов Rippa.";
const privateRobotsHeader = "noindex, nofollow, noarchive";

const securityHeaders = {
  "content-security-policy": [
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join("; "),
  "cross-origin-opener-policy": "same-origin",
  "x-dns-prefetch-control": "on",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "referrer-policy": "strict-origin-when-cross-origin",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "x-download-options": "noopen",
  "x-frame-options": "SAMEORIGIN"
};

const privateRouteRule = {
  ssr: false,
  robots: false,
  headers: {
    ...securityHeaders,
    "cache-control": "no-store, no-cache, must-revalidate",
    "x-robots-tag": privateRobotsHeader
  }
};

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  modules: [
    "@nuxt/eslint",
    "@nuxt/ui",
    "@pinia/nuxt",
    "pinia-plugin-persistedstate/nuxt",
    "@vueuse/nuxt",
    "vue-sonner/nuxt",
    "@nuxtjs/seo"
  ],
  app: {
    head: {
      htmlAttrs: {
        lang: "ru"
      },
      link: [
        { rel: "icon", href: "/favicon.ico", sizes: "any" },
        { rel: "apple-touch-icon", href: "/logo.png" },
        { rel: "manifest", href: "/site.webmanifest" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
        { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700;800&family=Tektur:wght@500;600;700;800;900&display=swap" }
      ],
      meta: [
        { name: "application-name", content: siteName },
        { name: "theme-color", content: "#facc15" },
        { name: "format-detection", content: "telephone=no" }
      ]
    }
  },
  css: ["./app/assets/css/main.css"],
  components: [
    { path: "~/shared/ui", pathPrefix: false },
    { path: "~/shared/ui/charts", pathPrefix: false },
    { path: "~/entities/product/ui", pathPrefix: false },
    { path: "~/entities/order/ui", pathPrefix: false },
    { path: "~/features/cart/ui", pathPrefix: false },
    { path: "~/features/checkout/ui", pathPrefix: false },
    { path: "~/features/admin-products/ui", pathPrefix: false },
    { path: "~/features/admin-feedback/ui", pathPrefix: false },
    { path: "~/widgets/admin/ui", pathPrefix: false },
    { path: "~/widgets/public/ui", pathPrefix: false }
  ],
  imports: {
    dirs: ["app/shared/lib"]
  },
  devtools: {
    enabled: process.env.NODE_ENV !== "production"
  },
  colorMode: {
    preference: "light",
    fallback: "light",
    classSuffix: ""
  },
  pinia: {
    storesDirs: ["app/stores/**"]
  },
  vueSonner: {
    css: true
  },
  runtimeConfig: {
    yookassaShopId: process.env.YOOKASSA_SHOP_ID ?? process.env.YOKASSA_SHOP_ID,
    yookassaSecretKey: process.env.YOOKASSA_SECRET_KEY ?? process.env.YOKASSA_SECRET_KEY,
    yookassaApiUrl: process.env.YOOKASSA_API_URL,
    yookassaReturnUrl: process.env.YOOKASSA_RETURN_URL ?? process.env.YOKASSA_RETURN_URL,
    public: {
      appUrl: process.env.NUXT_PUBLIC_APP_URL ?? siteUrl
    }
  },
  site: {
    ...(siteUrl ? { url: siteUrl } : {}),
    name: siteName,
    description: siteDescription,
    defaultLocale: "ru-RU",
    trailingSlash: false
  },
  seo: {
    canonicalLowercase: true,
    canonicalQueryWhitelist: [],
    redirectToCanonicalSiteUrl: Boolean(siteUrl),
    meta: {
      ogImage: "/logo.png",
      ogImageAlt: "Логотип ПроТех76",
      ogLocale: "ru_RU",
      ogSiteName: siteName,
      twitterCard: "summary_large_image"
    }
  },
  robots: {
    credits: false,
    disallow: [
      "/admin",
      "/admin/**",
      "/auth",
      "/cart",
      "/checkout",
      "/favorites",
      "/messages",
      "/orders",
      "/orders/**",
      "/api/**"
    ],
    disallowNonIndexableRoutes: false,
    sitemap: ["/sitemap.xml"]
  },
  sitemap: {
    credits: false,
    discoverImages: true,
    sources: ["/__sitemap__/products.json"],
    urls: [
      {
        loc: "/",
        changefreq: "daily",
        priority: 1
      }
    ],
    exclude: [
      "/admin",
      "/admin/**",
      "/auth",
      "/cart",
      "/checkout",
      "/favorites",
      "/messages",
      "/orders",
      "/orders/**",
      "/api/**"
    ],
    defaults: {
      changefreq: "weekly",
      priority: 0.7
    }
  },
  ogImage: {
    defaults: {
      width: 1200,
      height: 630,
      extension: "png",
      alt: "ПроТех76 - запчасти и навесное оборудование для мини-экскаваторов Rippa"
    },
    security: {
      secret: process.env.NUXT_OG_IMAGE_SECRET,
      strict: process.env.NODE_ENV === "production"
    }
  },
  schemaOrg: {
    defaults: true,
    identity: {
      type: "LocalBusiness",
      name: siteName,
      description: siteDescription,
      logo: "/logo.png",
      telephone: "+79201309744",
      address: {
        streetAddress: "пр.-т Октября, д. 78д",
        addressLocality: "Ярославль",
        addressCountry: "RU"
      }
    }
  },
  routeRules: {
    "/**": {
      headers: securityHeaders
    },
    "/": {
      robots: {
        index: true,
        follow: true,
        "max-image-preview": "large"
      },
    },
    "/about": {
      robots: {
        index: true,
        follow: true,
        "max-image-preview": "large"
      }
    },
    "/product/**": {
      robots: {
        index: true,
        follow: true,
        "max-image-preview": "large"
      },
    },
    "/auth": {
      ...privateRouteRule
    },
    "/cart": {
      ...privateRouteRule
    },
    "/checkout": {
      ...privateRouteRule
    },
    "/favorites": {
      ...privateRouteRule
    },
    "/messages": {
      ...privateRouteRule
    },
    "/orders": {
      ...privateRouteRule
    },
    "/orders/**": {
      ...privateRouteRule
    },
    "/admin": {
      ...privateRouteRule
    },
    "/admin/**": {
      ...privateRouteRule
    },
    "/_nuxt/**": {
      headers: {
        ...securityHeaders,
        "cache-control": "public, max-age=31536000, immutable"
      }
    },
    "/favicon.ico": {
      headers: {
        ...securityHeaders,
        "cache-control": "public, max-age=86400"
      }
    },
    "/logo.png": {
      headers: {
        ...securityHeaders,
        "cache-control": "public, max-age=86400"
      }
    },
    "/site.webmanifest": {
      headers: {
        ...securityHeaders,
        "cache-control": "public, max-age=86400"
      }
    },
    "/uploads/**": {
      headers: {
        ...securityHeaders,
        "cache-control": "public, max-age=31536000, immutable"
      }
    },
    "/api/**": {
      cache: false,
      headers: {
        ...securityHeaders,
        "cache-control": "no-store, no-cache, must-revalidate",
        "x-robots-tag": privateRobotsHeader
      }
    },
  },
  nitro: {
    compressPublicAssets: true,
    experimental: {
      websocket: true
    }
  },
  vite: {
    optimizeDeps: {
      include: [
        '@formkit/auto-animate/vue',
        '@lucide/vue',
        '@unhead/schema-org/vue',
        '@vue/devtools-core',
        '@vue/devtools-kit',
        'zod',
      ]
    }
  }
})
