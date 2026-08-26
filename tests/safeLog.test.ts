import { describe, expect, it } from "vitest";
import { maskEmailForLogs, toSafeErrorLog } from "../server/utils/safeLog";

describe("safe logging", () => {
  it("masks the local part of an email address", () => {
    expect(maskEmailForLogs("buyer@example.com")).toBe("b***@example.com");
    expect(maskEmailForLogs("invalid")).toBe("[invalid-email]");
  });

  it("serializes errors without stack traces or arbitrary payloads", () => {
    expect(toSafeErrorLog(new Error("Provider timeout"))).toEqual({
      name: "Error"
    });
    expect(toSafeErrorLog({ secret: "must-not-leak" })).toEqual({
      type: "object"
    });
  });
});
