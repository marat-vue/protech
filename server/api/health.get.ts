export default defineEventHandler(() => ({
  status: "ok",
  timestamp: new Date().toISOString(),
  uptimeSeconds: Math.floor(process.uptime())
}));
