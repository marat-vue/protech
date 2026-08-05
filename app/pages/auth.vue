<template>
  <div class="mx-auto grid min-h-[calc(100dvh-9rem)] w-full max-w-295 items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1fr)] lg:px-8">
    <section class="hidden lg:block">
      <UBadge color="primary" variant="soft" class="rounded-full">
        Аккаунт покупателя
      </UBadge>
      <h1 class="mt-5 text-5xl font-semibold tracking-normal text-zinc-950 ">
        Войдите, чтобы покупки стали удобнее
      </h1>
      <div class="mt-8 grid gap-4">
        <div v-for="item in benefits" :key="item.title"
          class="flex gap-4 rounded-3xl bg-white p-4 shadow-sm shadow-zinc-950/5  ">
          <div class="grid size-11 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700  ">
            <component :is="item.icon" class="size-5" />
          </div>
          <div>
            <p class="font-semibold text-zinc-950">{{ item.title }}</p>
            <p class="mt-1 text-sm leading-6 text-zinc-500">{{ item.description }}</p>
          </div>
        </div>
      </div>
    </section>

    <UCard class="rounded-4xl bg-white ring-0 shadow-2xl shadow-zinc-950/10  " :ui="{ body: 'p-6 sm:p-8' }">
      <div v-if="verificationEmail" class="space-y-6">
        <div>
          <UBadge color="primary" variant="soft" class="rounded-full">
            Подтверждение почты
          </UBadge>
          <h2 class="mt-4 text-3xl font-semibold tracking-normal text-zinc-950">
            Введите код из письма
          </h2>
          <p class="mt-3 text-sm leading-6 text-zinc-500">
            Мы отправили 6 цифр на <strong class="font-semibold text-zinc-800">{{ verificationEmail }}</strong>.
          </p>
        </div>

        <form class="space-y-5" @submit.prevent="confirmEmailCode">
          <UFormField label="Код" required :error="fieldErrors.otp">
            <UInput v-model="verificationCode" class="w-full rounded-2xl bg-[#f9fafb] " size="xl" variant="none"
              inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000"
              :ui="{ base: 'h-14 rounded-2xl bg-transparent text-center text-xl font-semibold' }">
              <template #leading>
                <ShieldCheck class="size-5 text-zinc-400" />
              </template>
            </UInput>
          </UFormField>

          <UButton color="primary" size="xl" block class="rounded-full" type="submit"
            :loading="auth.pending && verificationAction === 'verify'" :disabled="auth.pending">
            <ShieldCheck class="size-5" />
            Подтвердить почту
          </UButton>
        </form>

        <div class="grid gap-2 sm:grid-cols-2">
          <UButton color="neutral" variant="ghost" size="lg" class="justify-center rounded-full" type="button"
            :loading="auth.pending && verificationAction === 'resend'" :disabled="auth.pending"
            @click="resendVerificationCode">
            <RefreshCw class="size-4" />
            Отправить ещё раз
          </UButton>

          <UButton color="neutral" variant="ghost" size="lg" class="justify-center rounded-full" type="button"
            :disabled="auth.pending" @click="returnToAuthForm">
            <ArrowLeft class="size-4" />
            Изменить email
          </UButton>
        </div>
      </div>

      <template v-else>
        <div class="mb-7">
          <div class="grid grid-cols-2 rounded-full bg-[#f9fafb] p-1 " role="tablist" aria-label="Режим авторизации">
            <button type="button" class="rounded-full px-4 py-2 text-sm font-medium transition"
              role="tab"
              :aria-selected="mode === 'login'"
              :class="mode === 'login' ? 'bg-white text-zinc-950 shadow-sm shadow-zinc-950/5' : 'text-zinc-500 '"
              @click="mode = 'login'">
              Вход
            </button>
            <button type="button" class="rounded-full px-4 py-2 text-sm font-medium transition"
              role="tab"
              :aria-selected="mode === 'register'"
              :class="mode === 'register' ? 'bg-white text-zinc-950 shadow-sm shadow-zinc-950/5' : 'text-zinc-500 '"
              @click="mode = 'register'">
              Регистрация
            </button>
          </div>
        </div>

        <form class="space-y-5" @submit.prevent="submit">
          <UFormField v-if="mode === 'register'" label="Имя" required :error="fieldErrors.name">
            <UInput v-model="form.name" class="w-full rounded-2xl bg-[#f9fafb] " size="xl" variant="none"
              autocomplete="name" placeholder="Как к вам обращаться" :ui="{ base: 'h-12 rounded-2xl bg-transparent' }">
              <template #leading>
                <UserRound class="size-5 text-zinc-400" />
              </template>
            </UInput>
          </UFormField>

          <UFormField label="Email" required :error="fieldErrors.email">
            <UInput v-model="form.email" class="w-full rounded-2xl bg-[#f9fafb] " size="xl" variant="none" type="email"
              autocomplete="email" placeholder="you@example.com" :ui="{ base: 'h-12 rounded-2xl bg-transparent' }">
              <template #leading>
                <Mail class="size-5 text-zinc-400" />
              </template>
            </UInput>
          </UFormField>

          <UFormField label="Пароль" required :error="fieldErrors.password">
            <UInput v-model="form.password" class="w-full rounded-2xl bg-[#f9fafb] " size="xl" variant="none"
              :type="showPassword ? 'text' : 'password'" autocomplete="current-password" placeholder="Минимум 8 символов"
              :ui="{ base: 'h-12 rounded-2xl bg-transparent' }">
              <template #leading>
                <LockKeyhole class="size-5 text-zinc-400" />
              </template>
              <template #trailing>
                <UButton color="neutral" variant="ghost" size="sm" square class="rounded-full" type="button"
                  :aria-label="showPassword ? 'Скрыть пароль' : 'Показать пароль'" @click="togglePasswordVisibility">
                  <EyeOff v-if="showPassword" class="size-5" />
                  <Eye v-else class="size-5" />
                </UButton>
              </template>
            </UInput>
          </UFormField>

          <USwitch v-model="form.rememberMe" label="Запомнить меня" />

          <UButton color="primary" size="xl" block class="rounded-full" type="submit" :loading="auth.pending">
            <LogIn class="size-5" />
            {{ mode === "login" ? "Войти" : "Создать аккаунт" }}
          </UButton>
        </form>
      </template>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, Eye, EyeOff, Heart, LockKeyhole, LogIn, Mail, PackageCheck, RefreshCw, ShieldCheck, ShoppingCart, UserRound } from "@lucide/vue";
import { z } from "zod";
import { toast } from "vue-sonner";
import { clearFieldErrors, getZodFieldErrors, replaceFieldErrors } from "~~/app/shared/lib/zodValidation";
import { getErrorMessage } from "~~/app/shared/lib/shopFormatters";
import { useAuthStore } from "~~/app/stores/auth";
import { useCartStore } from "~~/app/stores/cart";
import { useFavoritesStore } from "~~/app/stores/favorites";

useSeoMeta({
  title: "Вход и регистрация",
  description: "Войдите или создайте аккаунт ПроТех76, чтобы пользоваться корзиной, избранным и историей заказов.",
  robots: "noindex, nofollow"
});

const route = useRoute();
const auth = useAuthStore();
const cart = useCartStore();
const favorites = useFavoritesStore();
const mode = ref<"login" | "register">(route.query.mode === "register" ? "register" : "login");
const showPassword = ref(false);
const verificationAction = ref<"resend" | "verify" | null>(null);
const verificationCode = ref("");
const verificationEmail = ref("");
const fieldErrors = reactive<Record<string, string | undefined>>({});
const form = reactive({
  name: "",
  email: auth.lastEmail,
  password: "",
  rememberMe: true
});

const loginPayload = computed(() => ({
  email: form.email,
  password: form.password,
  rememberMe: form.rememberMe
}));

const benefits = [
  {
    title: "Корзина синхронизируется",
    description: "Добавленные товары сохраняются в аккаунте и доступны после повторного входа.",
    icon: ShoppingCart
  },
  {
    title: "Избранное под рукой",
    description: "Сохраняйте интересные позиции и возвращайтесь к ним перед покупкой.",
    icon: Heart
  },
  {
    title: "История заказов",
    description: "Отслеживайте статусы, оплату и состав каждого оформленного заказа.",
    icon: PackageCheck
  }
];

const loginSchema = z.strictObject({
  email: z.email("Введите корректный email"),
  password: z.string().min(1, "Введите пароль"),
  rememberMe: z.boolean()
});

const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2, "Введите имя").max(80, "Имя слишком длинное"),
  password: z.string().min(8, "Пароль должен быть не короче 8 символов")
});

const verificationCodeSchema = z.strictObject({
  email: z.email("Введите корректный email"),
  otp: z.string().regex(/^\d{6}$/, "Введите 6 цифр из письма")
});

const redirectTo = computed(() => {
  const redirect = Array.isArray(route.query.redirect) ? route.query.redirect[0] : route.query.redirect;
  return redirect?.startsWith("/") && !redirect.startsWith("/admin") ? redirect : "/";
});

const verificationCallbackUrl = computed(() => {
  const params = new URLSearchParams({ verified: "1" });

  if (redirectTo.value !== "/") {
    params.set("redirect", redirectTo.value);
  }

  return `/auth?${params.toString()}`;
});

watch(verificationCode, (value) => {
  const normalized = value.replace(/\D/g, "").slice(0, 6);

  if (value !== normalized) {
    verificationCode.value = normalized;
  }
});

onMounted(async () => {
  const verified = Array.isArray(route.query.verified) ? route.query.verified[0] : route.query.verified;

  if (verified !== "1") {
    return;
  }

  const user = auth.user ?? await auth.fetchMe();

  if (user) {
    toast.success("Почта подтверждена");
    await navigateTo(redirectTo.value, { replace: true });
    return;
  }

  mode.value = "login";
  toast.success("Почта подтверждена. Теперь войдите в аккаунт");
});

async function submit() {
  const parsed = mode.value === "login"
    ? { mode: "login" as const, result: loginSchema.safeParse(loginPayload.value) }
    : { mode: "register" as const, result: registerSchema.safeParse(form) };

  if (!parsed.result.success) {
    replaceFieldErrors(fieldErrors, getZodFieldErrors(parsed.result.error));
    toast.error("Проверьте поля формы");
    return;
  }

  clearFieldErrors(fieldErrors);

  try {
    if (parsed.mode === "login") {
      await auth.login({
        ...parsed.result.data,
        callbackURL: verificationCallbackUrl.value
      });
      toast.success("Вы вошли в аккаунт");
    } else {
      await auth.register({
        ...parsed.result.data,
        callbackURL: verificationCallbackUrl.value
      });
      form.password = "";
      openVerificationStep(parsed.result.data.email);
      toast.success("Аккаунт создан. Мы отправили код подтверждения");
      return;
    }

    await Promise.all([
      cart.fetchCart(),
      favorites.fetchFavorites()
    ]);
    await navigateTo(redirectTo.value, { replace: true });
  } catch (error) {
    if (parsed.mode === "login" && isEmailNotVerifiedError(error)) {
      openVerificationStep(parsed.result.data.email);
      toast.info("Мы отправили код подтверждения на почту");
      return;
    }

    toast.error(getAuthErrorMessage(error, mode.value === "login" ? "Не удалось войти" : "Не удалось создать аккаунт"));
  }
}

async function confirmEmailCode() {
  const parsed = verificationCodeSchema.safeParse({
    email: verificationEmail.value,
    otp: verificationCode.value
  });

  if (!parsed.success) {
    replaceFieldErrors(fieldErrors, getZodFieldErrors(parsed.error));
    toast.error("Проверьте код подтверждения");
    return;
  }

  clearFieldErrors(fieldErrors);
  verificationAction.value = "verify";

  try {
    await auth.verifyEmailCode(parsed.data);
    toast.success("Почта подтверждена");
    await Promise.all([
      cart.fetchCart(),
      favorites.fetchFavorites()
    ]);
    await navigateTo(redirectTo.value, { replace: true });
  } catch (error) {
    toast.error(getVerificationCodeErrorMessage(error, "Не удалось подтвердить код"));
  } finally {
    verificationAction.value = null;
  }
}

async function resendVerificationCode() {
  const email = verificationEmail.value;

  if (!email) {
    return;
  }

  verificationAction.value = "resend";

  try {
    await auth.resendVerificationCode(email);
    verificationCode.value = "";
    clearFieldErrors(fieldErrors);
    toast.success("Новый код отправлен");
  } catch (error) {
    toast.error(getVerificationCodeErrorMessage(error, "Не удалось отправить код"));
  } finally {
    verificationAction.value = null;
  }
}

function openVerificationStep(email: string) {
  verificationEmail.value = email.trim().toLowerCase();
  verificationCode.value = "";
  clearFieldErrors(fieldErrors);
}

function returnToAuthForm() {
  verificationEmail.value = "";
  verificationCode.value = "";
  clearFieldErrors(fieldErrors);
}

function getAuthErrorMessage(error: unknown, fallback: string) {
  const message = getErrorMessage(error, fallback);

  if (isEmailNotVerifiedMessage(message)) {
    return "Подтвердите почту: мы отправили код";
  }

  return message;
}

function getVerificationCodeErrorMessage(error: unknown, fallback: string) {
  const message = getErrorMessage(error, fallback);

  if (message === "Invalid OTP" || message === "INVALID_OTP") {
    return "Неверный код подтверждения";
  }

  if (message === "OTP expired" || message === "OTP_EXPIRED") {
    return "Код истёк. Отправьте новый код";
  }

  if (message === "Too many attempts" || message === "TOO_MANY_ATTEMPTS") {
    return "Слишком много попыток. Отправьте новый код";
  }

  return message;
}

function isEmailNotVerifiedError(error: unknown) {
  return isEmailNotVerifiedMessage(getErrorMessage(error, ""));
}

function isEmailNotVerifiedMessage(message: string) {
  return message === "Email not verified" || message === "EMAIL_NOT_VERIFIED";
}

function togglePasswordVisibility() {
  showPassword.value = !showPassword.value;
}
</script>
