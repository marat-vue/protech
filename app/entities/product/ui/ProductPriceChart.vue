<template>
  <section class="rounded-2xl bg-white p-4 shadow-sm shadow-zinc-950/5 sm:p-5">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 class="text-2xl font-semibold tracking-normal text-zinc-950">Динамика цены</h2>
        <p class="mt-1 text-sm text-zinc-500">
          Изменения цены по истории карточки товара
        </p>
      </div>
      <UBadge :color="trendMeta.color"
        variant="soft"
        class="rounded-full px-3 py-1.5"
      >
        {{ trendMeta.label }}
      </UBadge>
    </div>

    <div class="mt-5 grid items-stretch gap-3 lg:grid-cols-[minmax(260px,0.78fr)_minmax(0,1.35fr)]">
      <div class="grid h-full grid-cols-2 gap-3">
        <div class="rounded-2xl bg-[#f9fafb] p-4">
          <p class="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Сейчас</p>
          <p class="mt-2 text-xl font-semibold text-zinc-950 sm:text-2xl">{{ formatCurrency(currentValue) }}</p>
        </div>
        <div class="rounded-2xl bg-[#f9fafb] p-4">
          <p class="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Минимум</p>
          <p class="mt-2 text-xl font-semibold text-zinc-950 sm:text-2xl">{{ formatCurrency(minValue) }}</p>
        </div>
        <div class="rounded-2xl bg-[#f9fafb] p-4">
          <p class="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Максимум</p>
          <p class="mt-2 text-xl font-semibold text-zinc-950 sm:text-2xl">{{ formatCurrency(maxValue) }}</p>
        </div>
        <div class="rounded-2xl bg-[#f9fafb] p-4">
          <p class="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">За период</p>
          <p class="mt-2 text-xl font-semibold sm:text-2xl"
            :class="trendMeta.textClass"
          >
            {{ signedCurrency(changeAmount) }}
          </p>
          <p class="mt-1 text-sm text-zinc-500">{{ signedPercent(changePercent) }}</p>
        </div>
      </div>

      <div v-if="entries.length > 1"
        class="overflow-hidden rounded-2xl bg-[#f9fafb] p-3 sm:p-4 lg:flex lg:min-h-80"
      >
        <svg v-for="chart in chartViews"
          :key="chart.key"
          :viewBox="chart.viewBox"
          :class="chart.className"
          role="img"
          aria-label="График изменения цены"
        >
          <defs>
            <linearGradient :id="chart.gradientId"
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              <stop offset="0%"
                :stop-color.attr="trendMeta.stroke"
                stop-opacity="0.22"
              />
              <stop offset="100%"
                :stop-color.attr="trendMeta.stroke"
                stop-opacity="0"
              />
            </linearGradient>
          </defs>

          <g>
            <line v-for="line in chart.gridLines"
              :key="line.key"
              :x1.attr="svgNumber(chart.bounds.left)"
              :x2.attr="svgNumber(chart.bounds.right)"
              :y1.attr="svgNumber(line.y)"
              :y2.attr="svgNumber(line.y)"
              stroke="#e4e4e7"
              stroke-dasharray="4 8"
            />
            <text v-for="line in chart.gridLines"
              :key="`${line.key}-label`"
              :x.attr="svgNumber(chart.labelInset)"
              :y.attr="svgNumber(line.y + chart.gridLabelOffsetY)"
              fill="#71717a"
              :font-size.attr="chart.gridFontSize"
              :font-weight.attr="chart.gridFontWeight"
            >
              {{ compactCurrency(line.value) }}
            </text>
          </g>

          <path :d.attr="chart.areaPath"
            :fill.attr="`url(#${chart.gradientId})`"
          />
          <polyline :points.attr="chart.linePoints"
            fill="none"
            :stroke.attr="trendMeta.stroke"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="5"
          />

          <g v-for="point in chart.plottedPoints"
            :key="point.key"
          >
            <circle :cx.attr="svgNumber(point.x)"
              :cy.attr="svgNumber(point.y)"
              r="6"
              fill="white"
              :stroke.attr="trendMeta.stroke"
              stroke-width="4"
            />
            <text v-if="point.showValue"
              :x.attr="svgNumber(point.labelX)"
              :y.attr="svgNumber(point.labelY)"
              :text-anchor.attr="point.labelAnchor"
              fill="#18181b"
              :font-size.attr="chart.pointFontSize"
              font-weight="600"
            >
              {{ compactCurrency(point.value) }}
            </text>
          </g>

          <g>
            <text v-for="label in chart.xAxisLabels"
              :key="label.key"
              :x.attr="svgNumber(label.x)"
              :y.attr="svgNumber(chart.xAxisLabelY)"
              text-anchor="middle"
              fill="#71717a"
              :font-size.attr="chart.xAxisFontSize"
              :font-weight.attr="chart.xAxisFontWeight"
            >
              {{ label.label }}
            </text>
          </g>
        </svg>
      </div>

      <div v-else
        class="grid min-h-40 place-items-center rounded-2xl bg-[#f9fafb] px-6 text-center text-sm text-zinc-500 lg:min-h-80"
      >
        Пока есть только текущая цена. График появится после следующего изменения.
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { formatCurrency, toNumber } from "~~/app/shared/lib/shopFormatters";
import type { MoneyLike } from "~~/app/shared/types/shop";

type TrendColor = "neutral" | "primary" | "error";

const props = defineProps<{
  prices: Array<{
    id: number;
    value: MoneyLike;
    createdAt: string;
  }>;
}>();

const entries = computed(() =>
  [...props.prices]
    .map((price) => ({
      ...price,
      numericValue: toNumber(price.value)
    }))
    .filter((price) => Number.isFinite(price.numericValue) && price.numericValue > 0)
    .sort((first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime())
);
const values = computed(() => entries.value.map((entry) => entry.numericValue));
const firstValue = computed(() => values.value[0] ?? 0);
const currentValue = computed(() => values.value.at(-1) ?? 0);
const minValue = computed(() => values.value.length ? Math.min(...values.value) : 0);
const maxValue = computed(() => values.value.length ? Math.max(...values.value) : 0);
const changeAmount = computed(() => currentValue.value - firstValue.value);
const changePercent = computed(() => firstValue.value > 0 ? (changeAmount.value / firstValue.value) * 100 : 0);
const trendMeta = computed<{
  color: TrendColor;
  label: string;
  stroke: string;
  textClass: string;
}>(() => {
  if (changeAmount.value > 0) {
    return {
      color: "error",
      label: "Цена выросла",
      stroke: "#ef4444",
      textClass: "text-red-600"
    };
  }

  if (changeAmount.value < 0) {
    return {
      color: "primary",
      label: "Цена снизилась",
      stroke: "#facc15",
      textClass: "text-[var(--shop-accent-strong)]"
    };
  }

  return {
    color: "neutral",
    label: "Без изменений",
    stroke: "#71717a",
    textClass: "text-zinc-950"
  };
});

type ChartTextAnchor = "end" | "middle" | "start";
type ChartBounds = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};
type PriceChartVariant = {
  bounds: ChartBounds;
  className: string;
  gradientId: string;
  gridFontSize: number;
  gridFontWeight?: string;
  gridLabelOffsetY: number;
  key: "desktop" | "mobile";
  labelInset: number;
  pointFontSize: number;
  pointLabelMinY: number | null;
  pointLabelOffsetY: number;
  useEdgeLabels: boolean;
  viewBox: string;
  xAxisFontSize: number;
  xAxisFontWeight?: string;
  xAxisLabelY: number;
};
type PlottedPoint = {
  createdAt: string;
  key: string;
  labelAnchor: ChartTextAnchor;
  labelX: number;
  labelY: number;
  showValue: boolean;
  value: number;
  x: number;
  y: number;
};

const chartVariants: PriceChartVariant[] = [
  {
    bounds: {
      bottom: 286,
      height: 214,
      left: 106,
      right: 462,
      top: 64,
      width: 356
    },
    className: "block h-auto w-full lg:hidden",
    gradientId: "price-area-gradient-mobile",
    gridFontSize: 21,
    gridFontWeight: "600",
    gridLabelOffsetY: 7,
    key: "mobile",
    labelInset: 16,
    pointFontSize: 22,
    pointLabelMinY: 38,
    pointLabelOffsetY: 22,
    useEdgeLabels: true,
    viewBox: "0 0 520 360",
    xAxisFontSize: 19,
    xAxisFontWeight: "600",
    xAxisLabelY: 334
  },
  {
    bounds: {
      bottom: 260,
      height: 210,
      left: 72,
      right: 724,
      top: 36,
      width: 652
    },
    className: "hidden h-auto w-full lg:block lg:h-full lg:min-h-80",
    gradientId: "price-area-gradient-desktop",
    gridFontSize: 13,
    gridLabelOffsetY: 5,
    key: "desktop",
    labelInset: 18,
    pointFontSize: 13,
    pointLabelMinY: null,
    pointLabelOffsetY: 14,
    useEdgeLabels: false,
    viewBox: "0 0 760 320",
    xAxisFontSize: 13,
    xAxisLabelY: 300
  }
];
const chartViews = computed(() =>
  chartVariants.map((variant) => {
    const plottedPoints = buildPlottedPoints(variant);

    return {
      ...variant,
      areaPath: buildAreaPath(variant.bounds, plottedPoints),
      gridLines: buildGridLines(variant.bounds),
      linePoints: plottedPoints.map((point) => `${point.x},${point.y}`).join(" "),
      plottedPoints,
      xAxisLabels: buildXAxisLabels(plottedPoints)
    };
  })
);

function buildPlottedPoints(variant: PriceChartVariant): PlottedPoint[] {
  const range = Math.max(maxValue.value - minValue.value, 1);
  const lastIndex = Math.max(entries.value.length - 1, 1);

  return entries.value.map((entry, index) => {
    const x = variant.bounds.left + (index / lastIndex) * variant.bounds.width;
    const y = variant.bounds.top + variant.bounds.height - ((entry.numericValue - minValue.value) / range) * variant.bounds.height;
    const isFirst = index === 0;
    const isLast = index === entries.value.length - 1;
    const labelAnchor: ChartTextAnchor = variant.useEdgeLabels
      ? isFirst
        ? "start"
        : isLast
          ? "end"
          : "middle"
      : "middle";
    const labelX = variant.useEdgeLabels
      ? isFirst
        ? variant.bounds.left
        : isLast
          ? variant.bounds.right
          : x
      : x;
    const labelY = variant.pointLabelMinY === null
      ? y - variant.pointLabelOffsetY
      : Math.max(variant.pointLabelMinY, y - variant.pointLabelOffsetY);

    return {
      createdAt: entry.createdAt,
      key: `${entry.id}-${entry.createdAt}`,
      labelAnchor,
      labelX,
      labelY,
      showValue: index === 0 || index === entries.value.length - 1 || entry.numericValue === minValue.value || entry.numericValue === maxValue.value,
      value: entry.numericValue,
      x,
      y
    };
  });
}

function buildAreaPath(bounds: ChartBounds, plottedPoints: PlottedPoint[]) {
  if (!plottedPoints.length) {
    return "";
  }

  const first = plottedPoints[0]!;
  const last = plottedPoints[plottedPoints.length - 1]!;
  const line = plottedPoints.map((point) => `${point.x},${point.y}`).join(" L ");

  return `M ${first.x},${bounds.bottom} L ${line} L ${last.x},${bounds.bottom} Z`;
}

function buildGridLines(bounds: ChartBounds) {
  const steps = 4;
  const range = Math.max(maxValue.value - minValue.value, 1);

  return Array.from({ length: steps + 1 }, (_, index) => {
    const ratio = index / steps;
    const value = maxValue.value - range * ratio;

    return {
      key: `grid-${index}`,
      value,
      y: bounds.top + bounds.height * ratio
    };
  });
}

function buildXAxisLabels(plottedPoints: PlottedPoint[]) {
  if (!plottedPoints.length) {
    return [];
  }

  const indexes = [...new Set([
    0,
    Math.floor((plottedPoints.length - 1) / 2),
    plottedPoints.length - 1
  ])];

  return indexes.map((index) => {
    const point = plottedPoints[index]!;

    return {
      key: `x-${index}`,
      label: shortDate(point.createdAt),
      x: point.x
    };
  });
}

function compactCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
    notation: value >= 100000 ? "compact" : "standard",
    style: "currency",
    currency: "RUB"
  }).format(value);
}

function signedCurrency(value: number) {
  if (value === 0) {
    return "0 ₽";
  }

  return `${value > 0 ? "+" : "−"}${formatCurrency(Math.abs(value))}`;
}

function signedPercent(value: number) {
  if (Math.abs(value) < 0.05) {
    return "0%";
  }

  return `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%`;
}

function shortDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short"
  }).format(date);
}

function svgNumber(value: number) {
  return Number.isFinite(value) ? String(Math.round(value * 100) / 100) : "0";
}
</script>
