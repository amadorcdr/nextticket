-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TicketOriginType" AS ENUM ('PURCHASE', 'COMPLIMENTARY', 'STAFF', 'TRANSFER');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('ISSUED', 'USED', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TicketTransferStatus" AS ENUM ('PENDING', 'COMPLETED', 'REJECTED', 'CANCELED');

-- CreateTable
CREATE TABLE "Ticket" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "lastModifiedBy" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "purchaseId" UUID,
    "purchaseDetailId" UUID,
    "eventSeatId" UUID,
    "eventZoneId" UUID NOT NULL,
    "currentHolderId" UUID NOT NULL,
    "originType" "TicketOriginType" NOT NULL DEFAULT 'PURCHASE',
    "folio" VARCHAR(20) NOT NULL,
    "qrCode" VARCHAR(255) NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'ISSUED',

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketValidation" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ticketId" UUID NOT NULL,
    "validatorId" UUID NOT NULL,
    "validatedAt" TIMESTAMP(3) NOT NULL,
    "result" SMALLINT NOT NULL,
    "rejectionReason" VARCHAR(255),

    CONSTRAINT "TicketValidation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketTransfer" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "lastModifiedBy" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ticketId" UUID NOT NULL,
    "issuedTicketId" UUID,
    "fromUserId" UUID NOT NULL,
    "toUserId" UUID NOT NULL,
    "transferFee" DECIMAL(11,2) NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "status" "TicketTransferStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "TicketTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_folio_key" ON "Ticket"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_qrCode_key" ON "Ticket"("qrCode");

-- CreateIndex
CREATE INDEX "Ticket_purchaseId_idx" ON "Ticket"("purchaseId");

-- CreateIndex
CREATE INDEX "Ticket_eventZoneId_idx" ON "Ticket"("eventZoneId");

-- CreateIndex
CREATE INDEX "Ticket_eventSeatId_idx" ON "Ticket"("eventSeatId");

-- CreateIndex
CREATE INDEX "Ticket_currentHolderId_idx" ON "Ticket"("currentHolderId");

-- CreateIndex
CREATE INDEX "Ticket_originType_idx" ON "Ticket"("originType");

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- CreateIndex
CREATE INDEX "Ticket_issuedAt_idx" ON "Ticket"("issuedAt");

-- CreateIndex
CREATE INDEX "TicketValidation_ticketId_idx" ON "TicketValidation"("ticketId");

-- CreateIndex
CREATE INDEX "TicketValidation_validatorId_idx" ON "TicketValidation"("validatorId");

-- CreateIndex
CREATE INDEX "TicketValidation_validatedAt_idx" ON "TicketValidation"("validatedAt");

-- CreateIndex
CREATE INDEX "TicketValidation_result_idx" ON "TicketValidation"("result");

-- CreateIndex
CREATE INDEX "TicketTransfer_ticketId_idx" ON "TicketTransfer"("ticketId");

-- CreateIndex
CREATE INDEX "TicketTransfer_issuedTicketId_idx" ON "TicketTransfer"("issuedTicketId");

-- CreateIndex
CREATE INDEX "TicketTransfer_fromUserId_idx" ON "TicketTransfer"("fromUserId");

-- CreateIndex
CREATE INDEX "TicketTransfer_toUserId_idx" ON "TicketTransfer"("toUserId");

-- CreateIndex
CREATE INDEX "TicketTransfer_status_idx" ON "TicketTransfer"("status");

-- AddForeignKey
ALTER TABLE "TicketValidation" ADD CONSTRAINT "TicketValidation_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketTransfer" ADD CONSTRAINT "TicketTransfer_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketTransfer" ADD CONSTRAINT "TicketTransfer_issuedTicketId_fkey" FOREIGN KEY ("issuedTicketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

