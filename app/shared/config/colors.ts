export const ADMIN_THEME_COLORS = {
  accent: "#f97316",
  accentSoft: "#fff7ed",
  accentMuted: "#fed7aa",
  accentStrong: "#c2410c",
  surface: "#ffffff",
  surfaceMuted: "#f6f7f8",
  surfaceElevated: "#ffffff",
  border: "#e4e4e7",
  text: "#18181b",
  textMuted: "#71717a",
  textSubtle: "#a1a1aa",
  danger: "#b91c1c",
  warning: "#b45309",
  info: "#0369a1",
  success: "#f97316",
  ring: "#fdba74",
  chart: {
    green: "#f97316",
    blue: "#0ea5e9",
    amber: "#b45309",
    red: "#b91c1c",
    violet: "#8b5cf6"
  }
} as const;

export type AdminThemeColor = typeof ADMIN_THEME_COLORS;

export const SHOP_THEME_COLORS = {
  accent: "#f97316",
  accentSoft: "#fff7ed",
  accentMuted: "#fed7aa",
  accentStrong: "#c2410c",
  surface: "#ffffff",
  surfaceMuted: "#f6f7f8",
  surfaceElevated: "#ffffff",
  border: "#e4e4e7",
  text: "#18181b",
  textMuted: "#71717a",
  textSubtle: "#a1a1aa",
  danger: "#dc2626",
  warning: "#d97706",
  info: "#0284c7",
  success: "#f97316",
  ring: "#fdba74"
} as const;

export type ShopThemeColor = typeof SHOP_THEME_COLORS;
