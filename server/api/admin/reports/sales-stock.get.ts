import { send, setHeader } from "h3";
import {
  getPaidSalesFilters,
  parseAnalyticsQuery,
  toNumber
} from "~~/server/utils/analytics";
import { createXlsxWorkbook, type XlsxCell, type XlsxWorksheet } from "~~/server/utils/xlsx";

type SalesTotalsRow = {
  orders: number | bigint;
  quantity: number | bigint;
  revenue: unknown;
  cost: unknown;
};

type ProductSalesRow = {
  productId: number;
  article: string;
  name: string;
  categoryName: string | null;
  orders: number | bigint;
  quantity: number | bigint;
  revenue: unknown;
  cost: unknown;
  currentPrice: unknown;
  stockQuantity: number | bigint | null;
  isActive: boolean | null;
};

type CategorySalesRow = {
  categoryName: string | null;
  orders: number | bigint;
  quantity: number | bigint;
  revenue: unknown;
  cost: unknown;
};

type BreakdownRow = {
  key: string;
  orders: number | bigint;
  quantity: number | bigint;
  revenue: unknown;
};

type OrderLineRow = {
  orderId: number;
  createdAt: Date;
  paidAt: Date | null;
  orderStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  obtainingMethod: string;
  productArticle: string;
  productName: string;
  categoryName: string | null;
  quantity: number | bigint;
  price: unknown;
  lineTotal: unknown;
  cost: unknown;
};

type StockReportRow = {
  id: number;
  article: string;
  name: string;
  categoryName: string;
  currentPrice: number;
  costPrice: number;
  isActive: boolean;
  quantity: number;
  availability: string;
  updatedAt: Date;
  retailValue: number;
  costValue: number;
};

const paymentMethodLabels: Record<string, string> = {
  ONLINE: "Онлайн",
  OFFLINE: "Офлайн"
};

const obtainingMethodLabels: Record<string, string> = {
  DELIVERY: "Доставка",
  PICKUP: "Самовывоз"
};

const orderStatusLabels: Record<string, string> = {
  NEW: "Новый",
  CONFIRMED: "Подтвержден",
  PROCESSING: "В работе",
  SHIPPED: "Отправлен",
  COMPLETED: "Завершен",
  CANCELLED: "Отменен"
};

const paymentStatusLabels: Record<string, string> = {
  PENDING: "Ожидает",
  UPON_RECEIPT: "При получении",
  PAID: "Оплачен",
  CANCELLED: "Отменен"
};

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const query = parseAnalyticsQuery(event);
  const filters = getPaidSalesFilters(query);

  const [
    salesRows,
    productSalesRows,
    categorySalesRows,
    paymentMethodRows,
    obtainingMethodRows,
    orderLineRows,
    products
  ] = await Promise.all([
    prisma.$queryRaw<SalesTotalsRow[]>`
      SELECT
        COUNT(DISTINCT o."id")::int AS "orders",
        COALESCE(SUM(oi."quantity"), 0)::int AS "quantity",
        COALESCE(SUM(oi."line_total"), 0)::numeric AS "revenue",
        COALESCE(SUM(COALESCE(oi."cost_price", 0) * oi."quantity"), 0)::numeric AS "cost"
      FROM "payment" p
      JOIN "order" o ON o."id" = p."order_id"
      JOIN "order_item" oi ON oi."order_id" = o."id"
      WHERE ${filters}
    `,
    prisma.$queryRaw<ProductSalesRow[]>`
      SELECT
        oi."product_id" AS "productId",
        oi."product_article" AS "article",
        oi."product_name" AS "name",
        oi."category_name" AS "categoryName",
        COUNT(DISTINCT o."id")::int AS "orders",
        COALESCE(SUM(oi."quantity"), 0)::int AS "quantity",
        COALESCE(SUM(oi."line_total"), 0)::numeric AS "revenue",
        COALESCE(SUM(COALESCE(oi."cost_price", 0) * oi."quantity"), 0)::numeric AS "cost",
        COALESCE(MAX(product."current_price"), 0)::numeric AS "currentPrice",
        COALESCE(MAX(stock."quantity"), 0)::int AS "stockQuantity",
        BOOL_OR(product."is_active") AS "isActive"
      FROM "payment" p
      JOIN "order" o ON o."id" = p."order_id"
      JOIN "order_item" oi ON oi."order_id" = o."id"
      LEFT JOIN "product" product ON product."id" = oi."product_id"
      LEFT JOIN "product_stock" stock ON stock."product_id" = oi."product_id"
      WHERE ${filters}
      GROUP BY oi."product_id", oi."product_article", oi."product_name", oi."category_id", oi."category_name"
      ORDER BY "revenue" DESC
    `,
    prisma.$queryRaw<CategorySalesRow[]>`
      SELECT
        oi."category_name" AS "categoryName",
        COUNT(DISTINCT o."id")::int AS "orders",
        COALESCE(SUM(oi."quantity"), 0)::int AS "quantity",
        COALESCE(SUM(oi."line_total"), 0)::numeric AS "revenue",
        COALESCE(SUM(COALESCE(oi."cost_price", 0) * oi."quantity"), 0)::numeric AS "cost"
      FROM "payment" p
      JOIN "order" o ON o."id" = p."order_id"
      JOIN "order_item" oi ON oi."order_id" = o."id"
      WHERE ${filters}
      GROUP BY oi."category_id", oi."category_name"
      ORDER BY "revenue" DESC
    `,
    prisma.$queryRaw<BreakdownRow[]>`
      SELECT
        o."payment_method"::text AS "key",
        COUNT(DISTINCT o."id")::int AS "orders",
        COALESCE(SUM(oi."quantity"), 0)::int AS "quantity",
        COALESCE(SUM(oi."line_total"), 0)::numeric AS "revenue"
      FROM "payment" p
      JOIN "order" o ON o."id" = p."order_id"
      JOIN "order_item" oi ON oi."order_id" = o."id"
      WHERE ${filters}
      GROUP BY 1
      ORDER BY "revenue" DESC
    `,
    prisma.$queryRaw<BreakdownRow[]>`
      SELECT
        o."obtaining_method"::text AS "key",
        COUNT(DISTINCT o."id")::int AS "orders",
        COALESCE(SUM(oi."quantity"), 0)::int AS "quantity",
        COALESCE(SUM(oi."line_total"), 0)::numeric AS "revenue"
      FROM "payment" p
      JOIN "order" o ON o."id" = p."order_id"
      JOIN "order_item" oi ON oi."order_id" = o."id"
      WHERE ${filters}
      GROUP BY 1
      ORDER BY "revenue" DESC
    `,
    prisma.$queryRaw<OrderLineRow[]>`
      SELECT
        o."id" AS "orderId",
        o."created_at" AS "createdAt",
        p."paid_at" AS "paidAt",
        o."order_status"::text AS "orderStatus",
        p."payment_status"::text AS "paymentStatus",
        o."payment_method"::text AS "paymentMethod",
        o."obtaining_method"::text AS "obtainingMethod",
        oi."product_article" AS "productArticle",
        oi."product_name" AS "productName",
        oi."category_name" AS "categoryName",
        oi."quantity" AS "quantity",
        oi."price" AS "price",
        oi."line_total" AS "lineTotal",
        COALESCE(oi."cost_price", 0) * oi."quantity" AS "cost"
      FROM "payment" p
      JOIN "order" o ON o."id" = p."order_id"
      JOIN "order_item" oi ON oi."order_id" = o."id"
      WHERE ${filters}
      ORDER BY p."paid_at" DESC, o."id" DESC, oi."id" ASC
    `,
    prisma.product.findMany({
      select: {
        id: true,
        categoryId: true,
        name: true,
        article: true,
        currentPrice: true,
        costPrice: true,
        isActive: true,
        updatedAt: true,
        category: {
          select: {
            name: true
          }
        },
        productStocks: {
          select: {
            quantity: true,
            updatedAt: true
          }
        }
      },
      orderBy: [
        { category: { name: "asc" } },
        { name: "asc" }
      ]
    })
  ]);

  const totals = normalizeTotals(salesRows[0]);
  const stockRows = products.map((product) => {
    const stock = product.productStocks[0];
    const quantity = stock?.quantity ?? 0;
    const currentPrice = toNumber(product.currentPrice);
    const costPrice = toNumber(product.costPrice);

    return {
      id: product.id,
      article: product.article,
      name: product.name,
      categoryName: product.category.name,
      currentPrice,
      costPrice,
      isActive: product.isActive,
      quantity,
      availability: getAvailability(product.isActive, quantity),
      updatedAt: stock?.updatedAt ?? product.updatedAt,
      retailValue: currentPrice * quantity,
      costValue: costPrice * quantity
    };
  });
  const stockTotals = stockRows.reduce((acc, row) => {
    acc.totalQuantity += row.quantity;
    acc.retailValue += row.retailValue;
    acc.costValue += row.costValue;

    if (row.isActive) {
      acc.activeProducts += 1;
    }

    if (row.isActive && row.quantity > 0) {
      acc.availableProducts += 1;
    }

    if (row.quantity <= 0) {
      acc.outOfStock += 1;
    } else if (row.quantity <= 5) {
      acc.lowStock += 1;
    }

    return acc;
  }, {
    totalProducts: stockRows.length,
    activeProducts: 0,
    availableProducts: 0,
    lowStock: 0,
    outOfStock: 0,
    totalQuantity: 0,
    retailValue: 0,
    costValue: 0
  });

  const categoryLabel = query.categoryId
    ? products.find((product) => product.categoryId === query.categoryId)?.category.name ?? `ID ${query.categoryId}`
    : "Все категории";
  const workbook = createXlsxWorkbook(buildReportSheets({
    generatedAt: new Date(),
    startDate: query.startDate,
    endDate: query.endDate,
    categoryLabel,
    totals,
    stockTotals,
    productSalesRows,
    categorySalesRows,
    paymentMethodRows,
    obtainingMethodRows,
    orderLineRows,
    stockRows
  }));
  const filename = `protech-sales-stock-${formatDateKey(query.startDate)}-${formatDateKey(query.endDate)}.xlsx`;

  setHeader(event, "Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  setHeader(event, "Content-Disposition", `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
  setHeader(event, "Content-Length", workbook.length);

  return send(event, workbook, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
});

function buildReportSheets(report: {
  generatedAt: Date;
  startDate: Date;
  endDate: Date;
  categoryLabel: string;
  totals: ReturnType<typeof normalizeTotals>;
  stockTotals: {
    totalProducts: number;
    activeProducts: number;
    availableProducts: number;
    lowStock: number;
    outOfStock: number;
    totalQuantity: number;
    retailValue: number;
    costValue: number;
  };
  productSalesRows: ProductSalesRow[];
  categorySalesRows: CategorySalesRow[];
  paymentMethodRows: BreakdownRow[];
  obtainingMethodRows: BreakdownRow[];
  orderLineRows: OrderLineRow[];
  stockRows: StockReportRow[];
}): XlsxWorksheet[] {
  return [
    buildSummarySheet(report),
    buildProductSalesSheet(report.productSalesRows),
    buildStockSheet(report.stockRows),
    buildCategorySalesSheet(report.categorySalesRows),
    buildBreakdownSheet("Оплата", "Способ оплаты", paymentMethodLabels, report.paymentMethodRows),
    buildBreakdownSheet("Получение", "Способ получения", obtainingMethodLabels, report.obtainingMethodRows),
    buildOrderLinesSheet(report.orderLineRows)
  ];
}

function buildSummarySheet(report: Parameters<typeof buildReportSheets>[0]): XlsxWorksheet {
  return {
    name: "Сводка",
    columns: [{ width: 32 }, { width: 18 }, { width: 32 }],
    rows: [
      [{ value: "Отчет по продажам и складу", style: "title" }, "", ""],
      [],
      [{ value: "Сформирован", style: "label" }, { value: report.generatedAt, style: "date" }],
      [{ value: "Период", style: "label" }, `${formatDateKey(report.startDate)} - ${formatDateKey(report.endDate)}`],
      [{ value: "Категория", style: "label" }, report.categoryLabel],
      [],
      [{ value: "Продажи", style: "header" }, { value: "Значение", style: "header" }],
      ["Оплаченные заказы", { value: report.totals.orders, style: "integer" }],
      ["Продано товаров, шт.", { value: report.totals.quantity, style: "integer" }],
      ["Выручка", { value: report.totals.revenue, style: "money" }],
      ["Себестоимость", { value: report.totals.cost, style: "money" }],
      ["Валовая прибыль", { value: report.totals.grossProfit, style: "money" }],
      ["Валовая маржа", { value: report.totals.grossMargin, style: "percent" }],
      ["Средний чек", { value: report.totals.averageOrderValue, style: "money" }],
      [],
      [{ value: "Склад", style: "header" }, { value: "Значение", style: "header" }],
      ["Всего товарных позиций", { value: report.stockTotals.totalProducts, style: "integer" }],
      ["Активных позиций", { value: report.stockTotals.activeProducts, style: "integer" }],
      ["В наличии", { value: report.stockTotals.availableProducts, style: "integer" }],
      ["Мало на складе (1-5 шт.)", { value: report.stockTotals.lowStock, style: "integer" }],
      ["Нет в наличии", { value: report.stockTotals.outOfStock, style: "integer" }],
      ["Всего единиц на складе", { value: report.stockTotals.totalQuantity, style: "integer" }],
      ["Склад в розничных ценах", { value: report.stockTotals.retailValue, style: "money" }],
      ["Склад по себестоимости", { value: report.stockTotals.costValue, style: "money" }]
    ]
  };
}

function buildProductSalesSheet(rows: ProductSalesRow[]): XlsxWorksheet {
  return tableSheet("Продажи", [
    "ID товара",
    "Артикул",
    "Товар",
    "Категория",
    "Заказы",
    "Продано, шт.",
    "Выручка",
    "Себестоимость",
    "Валовая прибыль",
    "Маржа",
    "Остаток, шт.",
    "Наличие",
    "Текущая цена",
    "Активен"
  ], rows.map((row) => {
    const cost = toNumber(row.cost);
    const revenue = toNumber(row.revenue);
    const stockQuantity = toNumber(row.stockQuantity);

    return [
      { value: row.productId, style: "integer" },
      row.article,
      row.name,
      row.categoryName ?? "Без категории",
      { value: toNumber(row.orders), style: "integer" },
      { value: toNumber(row.quantity), style: "integer" },
      { value: revenue, style: "money" },
      { value: cost, style: "money" },
      { value: revenue - cost, style: "money" },
      { value: revenue ? (revenue - cost) / revenue : 0, style: "percent" },
      { value: stockQuantity, style: "integer" },
      getAvailability(Boolean(row.isActive), stockQuantity),
      { value: toNumber(row.currentPrice), style: "money" },
      row.isActive ? "Да" : "Нет"
    ];
  }), [10, 18, 42, 22, 12, 14, 16, 16, 16, 12, 14, 18, 16, 12]);
}

function buildStockSheet(rows: StockReportRow[]): XlsxWorksheet {
  return tableSheet("Остатки", [
    "ID товара",
    "Артикул",
    "Товар",
    "Категория",
    "Остаток, шт.",
    "Наличие",
    "Активен",
    "Текущая цена",
    "Себестоимость",
    "Стоимость в рознице",
    "Стоимость по себестоимости",
    "Обновлено"
  ], rows.map((row) => [
    { value: row.id, style: "integer" },
    row.article,
    row.name,
    row.categoryName,
    { value: row.quantity, style: "integer" },
    { value: row.availability, style: row.quantity <= 0 ? "warning" : row.quantity <= 5 ? "warning" : "success" },
    row.isActive ? "Да" : "Нет",
    { value: row.currentPrice, style: "money" },
    { value: row.costPrice, style: "money" },
    { value: row.retailValue, style: "money" },
    { value: row.costValue, style: "money" },
    { value: row.updatedAt, style: "date" }
  ]), [10, 18, 42, 22, 14, 18, 12, 16, 16, 20, 24, 20]);
}

function buildCategorySalesSheet(rows: CategorySalesRow[]): XlsxWorksheet {
  return tableSheet("Категории", [
    "Категория",
    "Заказы",
    "Продано, шт.",
    "Выручка",
    "Себестоимость",
    "Валовая прибыль",
    "Маржа"
  ], rows.map((row) => {
    const revenue = toNumber(row.revenue);
    const cost = toNumber(row.cost);

    return [
      row.categoryName ?? "Без категории",
      { value: toNumber(row.orders), style: "integer" },
      { value: toNumber(row.quantity), style: "integer" },
      { value: revenue, style: "money" },
      { value: cost, style: "money" },
      { value: revenue - cost, style: "money" },
      { value: revenue ? (revenue - cost) / revenue : 0, style: "percent" }
    ];
  }), [28, 12, 14, 16, 16, 16, 12]);
}

function buildBreakdownSheet(name: string, firstColumn: string, labels: Record<string, string>, rows: BreakdownRow[]): XlsxWorksheet {
  return tableSheet(name, [
    firstColumn,
    "Заказы",
    "Продано, шт.",
    "Выручка"
  ], rows.map((row) => [
    labels[row.key] ?? row.key,
    { value: toNumber(row.orders), style: "integer" },
    { value: toNumber(row.quantity), style: "integer" },
    { value: toNumber(row.revenue), style: "money" }
  ]), [24, 12, 14, 16]);
}

function buildOrderLinesSheet(rows: OrderLineRow[]): XlsxWorksheet {
  return tableSheet("Строки заказов", [
    "Заказ",
    "Создан",
    "Оплачен",
    "Статус заказа",
    "Статус оплаты",
    "Оплата",
    "Получение",
    "Артикул",
    "Товар",
    "Категория",
    "Количество",
    "Цена",
    "Сумма",
    "Себестоимость",
    "Валовая прибыль"
  ], rows.map((row) => {
    const revenue = toNumber(row.lineTotal);
    const cost = toNumber(row.cost);

    return [
      { value: row.orderId, style: "integer" },
      { value: row.createdAt, style: "date" },
      { value: row.paidAt, style: "date" },
      orderStatusLabels[row.orderStatus] ?? row.orderStatus,
      paymentStatusLabels[row.paymentStatus] ?? row.paymentStatus,
      paymentMethodLabels[row.paymentMethod] ?? row.paymentMethod,
      obtainingMethodLabels[row.obtainingMethod] ?? row.obtainingMethod,
      row.productArticle,
      row.productName,
      row.categoryName ?? "Без категории",
      { value: toNumber(row.quantity), style: "integer" },
      { value: toNumber(row.price), style: "money" },
      { value: revenue, style: "money" },
      { value: cost, style: "money" },
      { value: revenue - cost, style: "money" }
    ];
  }), [10, 20, 20, 18, 18, 14, 14, 18, 42, 22, 14, 14, 14, 16, 16]);
}

function tableSheet(name: string, headers: string[], rows: XlsxCell[][], widths: number[]): XlsxWorksheet {
  return {
    name,
    freezeRows: 1,
    autoFilterRow: rows.length ? 1 : undefined,
    columns: widths.map((width) => ({ width })),
    rows: [
      headers.map((header) => ({ value: header, style: "header" as const })),
      ...rows
    ]
  };
}

function normalizeTotals(row: SalesTotalsRow | undefined) {
  const orders = toNumber(row?.orders);
  const quantity = toNumber(row?.quantity);
  const revenue = toNumber(row?.revenue);
  const cost = toNumber(row?.cost);
  const grossProfit = revenue - cost;

  return {
    orders,
    quantity,
    revenue,
    cost,
    grossProfit,
    grossMargin: revenue ? grossProfit / revenue : 0,
    averageOrderValue: orders ? revenue / orders : 0
  };
}

function getAvailability(isActive: boolean, quantity: number) {
  if (!isActive) {
    return "Скрыт";
  }

  if (quantity <= 0) {
    return "Нет в наличии";
  }

  if (quantity <= 5) {
    return "Мало";
  }

  return "В наличии";
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
