import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendEmailVerificationCode } from "../server/utils/authEmail";

const sendYandexMailMock = vi.hoisted(() => vi.fn());

vi.mock("../server/utils/yandexMail", () => ({
  sendYandexMail: sendYandexMailMock
}));

describe("auth verification email", () => {
  beforeEach(() => {
    sendYandexMailMock.mockReset();
  });

  it("sends verification codes without links", async () => {
    await sendEmailVerificationCode({
      email: "buyer@example.com",
      otp: "123456"
    });

    expect(sendYandexMailMock).toHaveBeenCalledOnce();

    const message = sendYandexMailMock.mock.calls[0]?.[0];

    expect(message.subject).toContain("Код подтверждения email");
    expect(message.text).toContain("123456");
    expect(message.html).toContain("123456");
    expect(message.text).not.toMatch(/https?:\/\//);
    expect(message.html).not.toMatch(/https?:\/\//);
    expect(message.html).not.toContain("href=");
  });
});
