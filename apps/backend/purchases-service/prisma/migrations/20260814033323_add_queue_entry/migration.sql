-- CreateEnum
CREATE TYPE "QueueEntryStatus" AS ENUM ('WAITING', 'ADMITTED', 'EXPIRED', 'CANCELED');

-- CreateTable
CREATE TABLE "QueueEntry" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "idempotencyKey" UUID,
    "status" "QueueEntryStatus" NOT NULL DEFAULT 'WAITING',
    "admittedAt" TIMESTAMP(3),
    "admissionExpiresAt" TIMESTAMP(3),

    CONSTRAINT "QueueEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QueueEntry_eventId_status_idx" ON "QueueEntry"("eventId", "status");

-- CreateIndex
CREATE INDEX "QueueEntry_userId_idx" ON "QueueEntry"("userId");

-- CreateIndex
CREATE INDEX "QueueEntry_eventId_idempotencyKey_idx" ON "QueueEntry"("eventId", "idempotencyKey");

-- ─────────────────────────────────────────────────────────────
-- Partial unique indexes & CHECK constraints
-- Not expressible in schema.prisma; kept in sync manually (same pattern
-- used by tickets-service for its ISSUED-only unique index).
-- ─────────────────────────────────────────────────────────────

-- A user can only have ONE live entry (waiting or already admitted) per
-- event: this is what makes "unirme a la fila" idempotent by identity,
-- independently of the idempotencyKey (which only protects against a
-- single request being retried/duplicated in-flight).
CREATE UNIQUE INDEX "uk_queue_entries_active_user_event" ON "QueueEntry"("userId", "eventId") WHERE "status" IN ('WAITING', 'ADMITTED');

-- One entry per idempotencyKey within an event, when the client sent one.
CREATE UNIQUE INDEX "uk_queue_entries_idempotency" ON "QueueEntry"("eventId", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;

ALTER TABLE "QueueEntry" ADD CONSTRAINT "chk_qe_admission_pair" CHECK (("status" <> 'ADMITTED') OR ("admittedAt" IS NOT NULL AND "admissionExpiresAt" IS NOT NULL));
