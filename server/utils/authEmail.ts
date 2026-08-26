import { siteConfig } from "../../shared/config/site";
import { maskEmailForLogs, toSafeErrorLog } from "./safeLog";
import { sendYandexMail } from "./yandexMail";

type VerificationEmailInput = {
  url: string;
  user: {
    email: string;
    name?: string | null;
  };
};

type VerificationCodeEmailInput = {
  email: string;
  otp: string;
  type?: "sign-in" | "email-verification" | "forget-password" | "change-email";
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function normalizeEmailUrl(value: string): string {
  try {
    return new URL(value).toString();
  } catch {
    return value;
  }
}

export async function sendEmailVerificationCode({
  email,
  otp,
  type = "email-verification"
}: VerificationCodeEmailInput): Promise<void> {
  const brandName = siteConfig.name;
  const currentYear = new Date().getFullYear();
  const safeEmail = escapeHtml(email);
  const safeOtp = escapeHtml(otp);
  const subject = type === "email-verification"
    ? `Код подтверждения email — ${brandName}`
    : `Код безопасности — ${brandName}`;

  const text = [
    `Код подтверждения ${brandName}:`,
    "",
    otp,
    "",
    "Введите этот 6-значный код на странице регистрации или входа.",
    "Код действует 10 минут.",
    "",
    "Если вы не запрашивали код, просто проигнорируйте это письмо.",
    "",
    `С уважением, команда ${brandName}`
  ].join("\n");

  const html = `
    <!doctype html>
    <html lang="ru">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="x-apple-disable-message-reformatting">
        <meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
        <title>${escapeHtml(subject)}</title>
      </head>

      <body
        style="
          margin:0;
          padding:0;
          background-color:#f4f7f6;
          color:#18181b;
          font-family:Arial,Helvetica,sans-serif;
          -webkit-font-smoothing:antialiased;
        "
      >
        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
          style="width:100%;background-color:#f4f7f6"
        >
          <tr>
            <td align="center" style="padding:40px 16px">
              <table
                role="presentation"
                width="560"
                cellspacing="0"
                cellpadding="0"
                border="0"
                style="
                  width:560px;
                  max-width:100%;
                  background-color:#ffffff;
                  border:1px solid #e4e4e7;
                  border-radius:18px;
                  overflow:hidden;
                  box-shadow:0 12px 32px rgba(24,24,27,0.08);
                "
              >
                <tr>
                  <td style="padding:28px 40px;background-color:#064e3b;color:#ffffff">
                    <div style="font-size:22px;line-height:28px;font-weight:700">
                      ${brandName}
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:40px 40px 20px">
                    <h1
                      style="
                        margin:0 0 16px;
                        color:#18181b;
                        font-size:28px;
                        line-height:36px;
                        font-weight:700;
                      "
                    >
                      Код подтверждения email
                    </h1>

                    <p
                      style="
                        margin:0;
                        color:#52525b;
                        font-size:16px;
                        line-height:26px;
                      "
                    >
                      Введите этот код на странице регистрации или входа.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:12px 40px 28px">
                    <div
                      style="
                        display:inline-block;
                        padding:18px 24px;
                        border-radius:14px;
                        background-color:#f4f4f5;
                        color:#064e3b;
                        font-size:34px;
                        line-height:40px;
                        font-weight:700;
                        letter-spacing:6px;
                      "
                    >
                      ${safeOtp}
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:0 40px 40px">
                    <p
                      style="
                        margin:0 0 12px;
                        color:#71717a;
                        font-size:14px;
                        line-height:22px;
                      "
                    >
                      Код действует 10 минут. Если вы не запрашивали код, просто проигнорируйте это письмо.
                    </p>

                    <p
                      style="
                        margin:0;
                        color:#a1a1aa;
                        font-size:12px;
                        line-height:19px;
                      "
                    >
                      Письмо отправлено на адрес ${safeEmail}.<br>
                      © ${currentYear} ${brandName}. Все права защищены.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  try {
    await sendYandexMail({
      to: email,
      subject,
      text,
      html
    });
  } catch (error) {
    console.error("Failed to send verification code email", {
      email: maskEmailForLogs(email),
      error: toSafeErrorLog(error)
    });

    throw error;
  }
}

export async function sendEmailVerification({
  url,
  user
}: VerificationEmailInput): Promise<void> {
  const brandName = siteConfig.name;
  const displayName = user.name?.trim() || user.email;
  const verificationUrl = normalizeEmailUrl(url);

  const safeName = escapeHtml(displayName);
  const safeUrl = escapeHtml(verificationUrl);
  const currentYear = new Date().getFullYear();

  const subject = `Подтвердите электронную почту — ${brandName}`;

  const text = [
    `Здравствуйте, ${displayName}!`,
    "",
    `Благодарим вас за регистрацию в ${brandName}.`,
    "",
    "Чтобы подтвердить адрес электронной почты и войти в аккаунт, перейдите по ссылке:",
    verificationUrl,
    "",
    "Если ссылка не открывается, скопируйте её и вставьте в адресную строку браузера.",
    "",
    "Если вы не создавали аккаунт, никаких действий предпринимать не нужно — просто проигнорируйте это письмо.",
    "",
    `С уважением,`,
    `команда ${brandName}`
  ].join("\n");

  const html = `
    <!doctype html>
    <html lang="ru">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="x-apple-disable-message-reformatting">
        <meta name="format-detection" content="telephone=no,date=no,address=no,email=no">

        <title>${subject}</title>

        <style>
          @media only screen and (max-width: 620px) {
            .email-container {
              width: 100% !important;
            }

            .content-padding {
              padding-left: 24px !important;
              padding-right: 24px !important;
            }

            .email-title {
              font-size: 26px !important;
              line-height: 32px !important;
            }

            .verification-button {
              display: block !important;
              width: 100% !important;
              box-sizing: border-box !important;
              text-align: center !important;
            }
          }
        </style>
      </head>

      <body
        style="
          margin:0;
          padding:0;
          background-color:#f4f7f6;
          color:#18181b;
          font-family:Arial,Helvetica,sans-serif;
          -webkit-font-smoothing:antialiased;
        "
      >
        <!-- Скрытый текст, отображаемый в превью письма -->
        <div
          style="
            display:none;
            max-height:0;
            overflow:hidden;
            opacity:0;
            color:transparent;
            line-height:1px;
            font-size:1px;
          "
        >
          Подтвердите электронную почту, чтобы завершить регистрацию в ${brandName}.
        </div>

        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
          style="width:100%;background-color:#f4f7f6"
        >
          <tr>
            <td align="center" style="padding:40px 16px">
              <table
                role="presentation"
                width="600"
                cellspacing="0"
                cellpadding="0"
                border="0"
                class="email-container"
                style="
                  width:600px;
                  max-width:600px;
                  background-color:#ffffff;
                  border:1px solid #e4e4e7;
                  border-radius:20px;
                  overflow:hidden;
                  box-shadow:0 12px 32px rgba(24,24,27,0.08);
                "
              >
                <!-- Шапка -->
                <tr>
                  <td
                    class="content-padding"
                    style="
                      padding:28px 48px;
                      background-color:#064e3b;
                    "
                  >
                    <table
                      role="presentation"
                      width="100%"
                      cellspacing="0"
                      cellpadding="0"
                      border="0"
                    >
                      <tr>
                        <td
                          style="
                            color:#ffffff;
                            font-size:22px;
                            line-height:28px;
                            font-weight:700;
                            letter-spacing:-0.3px;
                          "
                        >
                          ${brandName}
                        </td>

                        <td
                          align="right"
                          style="
                            color:#a7f3d0;
                            font-size:13px;
                            line-height:20px;
                          "
                        >
                          Подтверждение аккаунта
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Основной контент -->
                <tr>
                  <td
                    class="content-padding"
                    style="padding:48px 48px 24px"
                  >
                    <div
                      style="
                        width:64px;
                        height:64px;
                        margin-bottom:24px;
                        border-radius:18px;
                        background-color:#d1fae5;
                        color:#047857;
                        font-size:32px;
                        line-height:64px;
                        text-align:center;
                      "
                    >
                      ✓
                    </div>

                    <h1
                      class="email-title"
                      style="
                        margin:0 0 20px;
                        color:#18181b;
                        font-size:32px;
                        line-height:40px;
                        font-weight:700;
                        letter-spacing:-0.6px;
                      "
                    >
                      Подтвердите электронную почту
                    </h1>

                    <p
                      style="
                        margin:0 0 16px;
                        color:#3f3f46;
                        font-size:17px;
                        line-height:28px;
                      "
                    >
                      Здравствуйте, <strong>${safeName}</strong>!
                    </p>

                    <p
                      style="
                        margin:0;
                        color:#52525b;
                        font-size:16px;
                        line-height:27px;
                      "
                    >
                      Благодарим вас за регистрацию в ${brandName}.
                      Подтвердите адрес электронной почты, чтобы завершить
                      создание аккаунта и получить доступ к сервису.
                    </p>
                  </td>
                </tr>

                <!-- Кнопка -->
                <tr>
                  <td
                    class="content-padding"
                    style="padding:16px 48px 32px"
                  >
                    <table
                      role="presentation"
                      cellspacing="0"
                      cellpadding="0"
                      border="0"
                    >
                      <tr>
                        <td
                          align="center"
                          bgcolor="#059669"
                          style="
                            border-radius:12px;
                            box-shadow:0 8px 18px rgba(5,150,105,0.22);
                          "
                        >
                          <a
                            href="${safeUrl}"
                            target="_blank"
                            class="verification-button"
                            style="
                              display:inline-block;
                              padding:15px 28px;
                              border:1px solid #059669;
                              border-radius:12px;
                              background-color:#059669;
                              color:#ffffff;
                              font-size:16px;
                              line-height:22px;
                              font-weight:700;
                              text-decoration:none;
                            "
                          >
                            Подтвердить электронную почту
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Резервная ссылка -->
                <tr>
                  <td
                    class="content-padding"
                    style="padding:0 48px 32px"
                  >
                    <table
                      role="presentation"
                      width="100%"
                      cellspacing="0"
                      cellpadding="0"
                      border="0"
                      style="
                        width:100%;
                        background-color:#f4f4f5;
                        border-radius:12px;
                      "
                    >
                      <tr>
                        <td style="padding:20px">
                          <p
                            style="
                              margin:0 0 10px;
                              color:#71717a;
                              font-size:13px;
                              line-height:20px;
                              font-weight:700;
                              text-transform:uppercase;
                              letter-spacing:0.5px;
                            "
                          >
                            Кнопка не открывается?
                          </p>

                          <p
                            style="
                              margin:0 0 12px;
                              color:#52525b;
                              font-size:14px;
                              line-height:22px;
                            "
                          >
                            Скопируйте эту ссылку и вставьте её в адресную
                            строку браузера:
                          </p>

                          <p
                            style="
                              margin:0;
                              font-size:14px;
                              line-height:22px;
                              word-break:break-all;
                            "
                          >
                            <a
                              href="${safeUrl}"
                              target="_blank"
                              style="
                                color:#047857;
                                font-weight:600;
                                text-decoration:underline;
                              "
                            >
                              ${safeUrl}
                            </a>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Предупреждение -->
                <tr>
                  <td
                    class="content-padding"
                    style="padding:0 48px 48px"
                  >
                    <table
                      role="presentation"
                      width="100%"
                      cellspacing="0"
                      cellpadding="0"
                      border="0"
                      style="
                        width:100%;
                        border-left:4px solid #d4d4d8;
                      "
                    >
                      <tr>
                        <td style="padding:4px 0 4px 16px">
                          <p
                            style="
                              margin:0;
                              color:#71717a;
                              font-size:14px;
                              line-height:22px;
                            "
                          >
                            Если вы не создавали аккаунт в ${brandName},
                            никаких действий предпринимать не нужно.
                            Просто проигнорируйте это письмо.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Подвал -->
                <tr>
                  <td
                    class="content-padding"
                    style="
                      padding:24px 48px 32px;
                      border-top:1px solid #e4e4e7;
                      background-color:#fafafa;
                    "
                  >
                    <p
                      style="
                        margin:0 0 8px;
                        color:#52525b;
                        font-size:14px;
                        line-height:22px;
                        font-weight:700;
                      "
                    >
                      С уважением, команда ${brandName}
                    </p>

                    <p
                      style="
                        margin:0;
                        color:#a1a1aa;
                        font-size:12px;
                        line-height:19px;
                      "
                    >
                      Это автоматическое сообщение. Отвечать на него не нужно.
                      <br>
                      © ${currentYear} ${brandName}. Все права защищены.
                    </p>
                  </td>
                </tr>
              </table>

              <p
                style="
                  max-width:560px;
                  margin:20px auto 0;
                  color:#a1a1aa;
                  font-size:12px;
                  line-height:18px;
                  text-align:center;
                "
              >
                Письмо отправлено на адрес ${escapeHtml(user.email)},
                указанный при регистрации.
              </p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  try {
    await sendYandexMail({
      to: user.email,
      subject,
      text,
      html
    });
  } catch (error) {
    console.error("Failed to send verification email", {
      email: maskEmailForLogs(user.email),
      error: toSafeErrorLog(error)
    });

    throw error;
  }
}
