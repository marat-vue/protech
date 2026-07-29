<template>
  <UModal
    v-model:open="open"
    title="Заказать звонок"
    description="Оставьте контакты — мы перезвоним и поможем с подбором."
    :ui="modalUi"
  >
    <template #body>
      <form class="space-y-5 p-1" @submit.prevent="submit">
        <div class="flex items-start gap-3 rounded-3xl bg-(--shop-accent-soft) p-4">
          <span class="grid size-11 shrink-0 place-items-center rounded-2xl bg-(--shop-accent-muted) text-(--shop-accent-strong)">
            <UIcon name="i-lucide-phone-call" class="size-5" />
          </span>
          <div>
            <p class="font-semibold text-zinc-950">Ответим в рабочее время</p>
            <p class="mt-1 text-sm leading-6 text-zinc-600">
              Уточним задачу, совместимость запчасти и удобный способ получения.
            </p>
          </div>
        </div>

        <UFormField label="Ваше имя" required :error="fieldErrors.name">
          <UInput
            v-model="form.name"
            size="xl"
            variant="none"
            autocomplete="name"
            placeholder="Как к вам обращаться"
            class="w-full rounded-2xl bg-[#f6f7f8]"
            :ui="inputUi"
          >
            <template #leading>
              <UIcon name="i-lucide-user-round" class="size-5 text-zinc-400" />
            </template>
          </UInput>
        </UFormField>

        <UFormField label="Телефон" required :error="fieldErrors.phone">
          <UInput
            v-model="form.phone"
            size="xl"
            variant="none"
            type="tel"
            inputmode="tel"
            autocomplete="tel"
            placeholder="+7 900 000-00-00"
            class="w-full rounded-2xl bg-[#f6f7f8]"
            :ui="inputUi"
          >
            <template #leading>
              <UIcon name="i-lucide-phone" class="size-5 text-zinc-400" />
            </template>
          </UInput>
        </UFormField>

        <div>
          <UCheckbox
            v-model="form.consentAccepted"
            color="primary"
            class="items-start rounded-2xl bg-[#f9fafb] p-4"
          >
            <template #label>
              <span class="text-sm leading-5 text-zinc-600">
                Соглашаюсь на обработку персональных данных для обратной связи.
              </span>
            </template>
          </UCheckbox>
          <p v-if="fieldErrors.consentAccepted" class="mt-2 px-1 text-sm text-red-600">
            {{ fieldErrors.consentAccepted }}
          </p>
        </div>

        <UButton
          color="primary"
          size="xl"
          block
          type="submit"
          icon="i-lucide-send"
          class="min-h-12 rounded-full font-semibold shadow-lg shadow-yellow-950/10"
          :loading="submitting"
        >
          Отправить заявку
        </UButton>

        <p class="text-center text-xs leading-5 text-zinc-400">
          Или позвоните нам:
          <a class="font-semibold text-zinc-700 hover:text-(--shop-accent-strong)" href="tel:+79201309744">
            +7 920 130-97-44
          </a>
        </p>
      </form>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { toast } from "vue-sonner";
import { getErrorMessage } from "~~/app/shared/lib/shopFormatters";
import { shopFetch } from "~~/app/shared/lib/shopFetch";
import { clearFieldErrors, getZodFieldErrors, replaceFieldErrors } from "~~/app/shared/lib/zodValidation";
import { useAuthStore } from "~~/app/stores/auth";
import { createCallbackRequestSchema } from "~~/shared/schemas/callbackRequests/createCallbackRequest";

const open = defineModel<boolean>("open", { required: true });
const route = useRoute();
const auth = useAuthStore();
const submitting = ref(false);
const fieldErrors = reactive<Record<string, string | undefined>>({});
const form = reactive({
  name: "",
  phone: "",
  consentAccepted: false
});

const inputUi = {
  base: "h-12 rounded-2xl bg-transparent text-zinc-900 placeholder:text-zinc-400"
};
const modalUi = {
  overlay: "bg-zinc-950/55 backdrop-blur-sm",
  content: "max-w-lg overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-zinc-950/25 ring-0",
  header: "px-5 pb-3 pt-5 sm:px-6 sm:pt-6",
  title: "text-xl font-semibold text-zinc-950",
  description: "mt-1 text-sm leading-6 text-zinc-500",
  body: "px-5 pb-5 pt-2 sm:px-6 sm:pb-6"
};

watch(open, (isOpen) => {
  if (!isOpen) {
    return;
  }

  clearFieldErrors(fieldErrors);
  form.name ||= auth.user?.name ?? "";
});

async function submit() {
  const parsed = createCallbackRequestSchema.safeParse({
    ...form,
    sourcePath: route.fullPath
  });

  if (!parsed.success) {
    replaceFieldErrors(fieldErrors, getZodFieldErrors(parsed.error));
    toast.error("Проверьте данные заявки");
    return;
  }

  clearFieldErrors(fieldErrors);
  submitting.value = true;

  try {
    await shopFetch("/api/public/callback-requests", {
      method: "POST",
      body: parsed.data
    });
    toast.success("Заявка отправлена — мы вам перезвоним");
    form.phone = "";
    form.consentAccepted = false;
    open.value = false;
  } catch (error) {
    toast.error(getErrorMessage(error, "Не удалось отправить заявку"));
  } finally {
    submitting.value = false;
  }
}
</script>
