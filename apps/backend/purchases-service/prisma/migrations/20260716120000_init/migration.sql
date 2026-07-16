-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TemporaryBlockStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'RELEASED');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'TRANSFER', 'DIGITAL_WALLET');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REFUNDED');

-- CreateTable
CREATE TABLE "TemporaryBlock" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "lastModifiedBy" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" UUID NOT NULL,
    "eventZoneId" UUID NOT NULL,
    "eventSeatId" UUID,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "TemporaryBlockStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "TemporaryBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "lastModifiedBy" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "folio" BIGINT,
    "grossSubtotal" DECIMAL(11,2) NOT NULL,
    "discountAmount" DECIMAL(11,2) NOT NULL DEFAULT 0,
    "netSubtotal" DECIMAL(11,2) NOT NULL,
    "taxAmount" DECIMAL(11,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(11,2) NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseDetail" (
    "id" UUID NOT NULL,
    "purchaseId" UUID NOT NULL,
    "eventZoneId" UUID NOT NULL,
    "eventSeatId" UUID,
    "priceTierId" UUID,
    "promoCodeUsageId" UUID,
    "unitPrice" DECIMAL(11,2) NOT NULL,
    "discountAmount" DECIMAL(11,2) NOT NULL DEFAULT 0,
    "finalPrice" DECIMAL(11,2) NOT NULL,
    "taxAmount" DECIMAL(11,2) NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(11,2) NOT NULL,

    CONSTRAINT "PurchaseDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "lastModifiedBy" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "purchaseId" UUID,
    "transferId" UUID,
    "amount" DECIMAL(11,2) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "externalReference" VARCHAR(100),
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TemporaryBlock_userId_idx" ON "TemporaryBlock"("userId");

-- CreateIndex
CREATE INDEX "TemporaryBlock_eventZoneId_idx" ON "TemporaryBlock"("eventZoneId");

-- CreateIndex
CREATE INDEX "TemporaryBlock_eventSeatId_idx" ON "TemporaryBlock"("eventSeatId");

-- CreateIndex
CREATE INDEX "TemporaryBlock_status_expiresAt_idx" ON "TemporaryBlock"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_folio_key" ON "Purchase"("folio");

-- CreateIndex
CREATE INDEX "Purchase_userId_idx" ON "Purchase"("userId");

-- CreateIndex
CREATE INDEX "Purchase_eventId_idx" ON "Purchase"("eventId");

-- CreateIndex
CREATE INDEX "Purchase_status_idx" ON "Purchase"("status");

-- CreateIndex
CREATE INDEX "Purchase_createdAt_idx" ON "Purchase"("createdAt");

-- CreateIndex
CREATE INDEX "PurchaseDetail_purchaseId_idx" ON "PurchaseDetail"("purchaseId");

-- CreateIndex
CREATE INDEX "PurchaseDetail_eventZoneId_idx" ON "PurchaseDetail"("eventZoneId");

-- CreateIndex
CREATE INDEX "PurchaseDetail_eventSeatId_idx" ON "PurchaseDetail"("eventSeatId");

-- CreateIndex
CREATE INDEX "PurchaseDetail_priceTierId_idx" ON "PurchaseDetail"("priceTierId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseDetail_purchaseId_eventSeatId_key" ON "PurchaseDetail"("purchaseId", "eventSeatId");

-- CreateIndex
CREATE INDEX "Payment_purchaseId_idx" ON "Payment"("purchaseId");

-- CreateIndex
CREATE INDEX "Payment_transferId_idx" ON "Payment"("transferId");

-- CreateIndex
CREATE INDEX "Payment_paymentMethod_idx" ON "Payment"("paymentMethod");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- AddForeignKey
ALTER TABLE "PurchaseDetail" ADD CONSTRAINT "PurchaseDetail_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- Financial & integrity CHECK constraints
-- Not expressible in schema.prisma; mirrors the reference model
-- (nextticket.sql · MODULE: PURCHASE). Kept in sync manually.
-- ─────────────────────────────────────────────────────────────

-- TemporaryBlock: hold must be positive; a reserved seat implies quantity 1; window must be valid
ALTER TABLE "TemporaryBlock" ADD CONSTRAINT "chk_tb_positive_quantity" CHECK ("quantity" > 0);
ALTER TABLE "TemporaryBlock" ADD CONSTRAINT "chk_tb_reserved_quantity" CHECK ("eventSeatId" IS NULL OR "quantity" = 1);
ALTER TABLE "TemporaryBlock" ADD CONSTRAINT "chk_tb_valid_window" CHECK ("expiresAt" > "startedAt");

-- Purchase: non-negative amounts and the financial equations (SAT-compliant)
ALTER TABLE "Purchase" ADD CONSTRAINT "chk_purchases_non_negative" CHECK ("grossSubtotal" >= 0 AND "discountAmount" >= 0 AND "netSubtotal" >= 0 AND "taxAmount" >= 0 AND "total" >= 0);
ALTER TABLE "Purchase" ADD CONSTRAINT "chk_purchases_sat_compliance" CHECK ("netSubtotal" = "grossSubtotal" - "discountAmount");
ALTER TABLE "Purchase" ADD CONSTRAINT "chk_purchases_financial_equation" CHECK ("total" = "netSubtotal" + "taxAmount");

-- PurchaseDetail: one seat per row; non-negative prices; per-line financial math
ALTER TABLE "PurchaseDetail" ADD CONSTRAINT "chk_pd_quantity_one" CHECK ("quantity" = 1);
ALTER TABLE "PurchaseDetail" ADD CONSTRAINT "chk_pd_positive_prices" CHECK ("unitPrice" >= 0 AND "discountAmount" >= 0 AND "finalPrice" >= 0 AND "taxAmount" >= 0 AND "subtotal" >= 0);
ALTER TABLE "PurchaseDetail" ADD CONSTRAINT "chk_pd_financial_math" CHECK ("finalPrice" = "unitPrice" - "discountAmount");
ALTER TABLE "PurchaseDetail" ADD CONSTRAINT "chk_pd_subtotal_math" CHECK ("subtotal" = "finalPrice" * "quantity");

-- Payment: exactly one origin (purchase XOR transfer) and a positive amount
ALTER TABLE "Payment" ADD CONSTRAINT "chk_payments_single_origin" CHECK (("purchaseId" IS NOT NULL) <> ("transferId" IS NOT NULL));
ALTER TABLE "Payment" ADD CONSTRAINT "chk_payments_positive_amount" CHECK ("amount" > 0);
