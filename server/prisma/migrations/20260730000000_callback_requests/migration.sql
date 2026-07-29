-- CreateEnum
CREATE TYPE "CallbackRequestStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "callback_request" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "consent_accepted" BOOLEAN NOT NULL,
    "source_path" TEXT,
    "status" "CallbackRequestStatus" NOT NULL DEFAULT 'NEW',
    "admin_note" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "callback_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "callback_request_status_created_at_idx" ON "callback_request"("status", "created_at");

-- CreateIndex
CREATE INDEX "callback_request_phone_idx" ON "callback_request"("phone");
