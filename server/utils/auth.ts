import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import { bearer, emailOTP } from "better-auth/plugins";
import { sendEmailVerificationCode } from "./authEmail";

const isProduction = process.env.NODE_ENV === "production";

export const auth = betterAuth({
  appName: "ПроТех76",
  baseURL: process.env.BETTER_AUTH_URL,
  basePath: "/api/auth",
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "USER",
        input: false,
      },
    },
  },
  advanced: {
    disableOriginCheck: !isProduction,
    disableCSRFCheck: !isProduction,
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    requireEmailVerification: true,
  },
  emailVerification: {
    autoSignInAfterVerification: true,
    expiresIn: 60 * 10,
    sendOnSignIn: true,
    sendOnSignUp: true,
  },
  plugins: [
    emailOTP({
      allowedAttempts: 5,
      expiresIn: 60 * 10,
      otpLength: 6,
      overrideDefaultEmailVerification: true,
      rateLimit: {
        max: 5,
        window: 60
      },
      storeOTP: "hashed",
      sendVerificationOTP: async ({ email, otp, type }) => {
        await sendEmailVerificationCode({ email, otp, type });
      },
    }),
    bearer()
  ],
});
