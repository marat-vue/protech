export function maskEmailForLogs(email: string) {
  const normalized = email.trim();
  const separator = normalized.lastIndexOf("@");

  if (separator <= 0 || separator === normalized.length - 1) {
    return "[invalid-email]";
  }

  const localPart = normalized.slice(0, separator);
  const domain = normalized.slice(separator + 1);

  return `${localPart.slice(0, 1)}***@${domain}`;
}

export function toSafeErrorLog(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name
    };
  }

  return { type: typeof error };
}
