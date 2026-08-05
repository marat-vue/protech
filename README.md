# ПроТех76

Nuxt 4 витрина и админ-панель для каталога ПроТех76: товары, корзина, заказы, отзывы, сообщения, склад, аналитика, YooKassa и загрузка медиа в S3.

## Локальная разработка

```bash
npm install
cp .env.example .env
npm run prisma:migrate:deploy
npm run seed:admin
npm run dev
```

## Чеклист перед деплоем

- Задайте `DATABASE_URL` или отдельные переменные `DB_*`.
- Задайте production-значения для `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NUXT_SITE_URL`, `NUXT_PUBLIC_SITE_URL`, `NUXT_PUBLIC_APP_URL` и `NUXT_OG_IMAGE_SECRET`.
- Заполните переменные YooKassa перед включением онлайн-оплаты.
- Проверьте фискальные переменные YooKassa: `YOOKASSA_RECEIPT_VAT_CODE`, `YOOKASSA_RECEIPT_TAX_SYSTEM_CODE`, `YOOKASSA_RECEIPT_PAYMENT_MODE`, `YOOKASSA_RECEIPT_PAYMENT_SUBJECT`.
- Заполните `AWS_REGION`, `AWS_S3_BUCKET`, `S3_ENDPOINT`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` и `S3_PUBLIC_URL` перед использованием загрузок.
- Перед деплоем запустите `npm run check`, `npm run test:integration` и `npm run build`.
- Миграции применяйте через `npm run prisma:migrate:deploy`; `npm run seed:admin` запускайте только когда нужно создать или обновить настроенный admin-аккаунт.

## Скрипты

- `npm run dev` - запуск Nuxt dev server.
- `npm run check` - Prisma validate/generate, typecheck и lint.
- `npm run test:integration` - интеграционные тесты Vitest.
- `npm run build` - сборка Nitro server для деплоя.
- `npm run start` - запуск `.output/server/index.mjs` после сборки.
