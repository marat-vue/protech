import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeEmailUrl, sendEmailVerification } from "../server/utils/authEmail";

const sendYandexMailMock = vi.hoisted(() => vi.fn());

vi.mock("../server/utils/yandexMail", () => ({
  sendYandexMail: sendYandexMailMock
}));

describe("auth verification email", () => {
  beforeEach(() => {
    sendYandexMailMock.mockReset();
  });

  it("normalizes IDN verification links to punycode", () => {
    expect(normalizeEmailUrl("https://протех76.рф/api/auth/verify-email?token=abc")).toBe(
      "https://xn--76-mlc9aegpz.xn--p1ai/api/auth/verify-email?token=abc"
    );
  });

  it("sends normalized verification links in text and HTML parts", async () => {
    await sendEmailVerification({
      url: "https://протех76.рф/api/auth/verify-email?token=abc",
      user: {
        email: "buyer@example.com",
        name: "Мария"
      }
    });

    expect(sendYandexMailMock).toHaveBeenCalledOnce();

    const message = sendYandexMailMock.mock.calls[0]?.[0];

    expect(message.text).toContain("https://xn--76-mlc9aegpz.xn--p1ai/api/auth/verify-email?token=abc");
    expect(message.html).toContain("href=\"https://xn--76-mlc9aegpz.xn--p1ai/api/auth/verify-email?token=abc\"");
    expect(message.text).not.toContain("https://протех76.рф");
    expect(message.html).not.toContain("https://протех76.рф");
  });
});
