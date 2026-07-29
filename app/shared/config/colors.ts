export const ADMIN_THEME_COLORS = {
  accent: "#facc15",
  accentSoft: "#fefce8",
  accentMuted: "#fef08a",
  accentStrong: "#a16207",
  surface: "#ffffff",
  surfaceMuted: "#f6f7f8",
  surfaceElevated: "#ffffff",
  border: "#e4e4e7",
  text: "#18181b",
  textMuted: "#71717a",
  textSubtle: "#a1a1aa",
  danger: "#b91c1c",
  warning: "#a16207",
  info: "#0369a1",
  success: "#facc15",
  ring: "#fde047",
  chart: {
    green: "#facc15",
    blue: "#0ea5e9",
    amber: "#a16207",
    red: "#b91c1c",
    violet: "#8b5cf6"
  }
} as const;

export type AdminThemeColor = typeof ADMIN_THEME_COLORS;

export const SHOP_THEME_COLORS = {
  accent: "#facc15",
  accentSoft: "#fefce8",
  accentMuted: "#fef08a",
  accentStrong: "#a16207",
  surface: "#ffffff",
  surfaceMuted: "#f6f7f8",
  surfaceElevated: "#ffffff",
  border: "#e4e4e7",
  text: "#18181b",
  textMuted: "#71717a",
  textSubtle: "#a1a1aa",
  danger: "#dc2626",
  warning: "#ca8a04",
  info: "#0284c7",
  success: "#facc15",
  ring: "#fde047"
} as const;

export type ShopThemeColor = typeof SHOP_THEME_COLORS;
