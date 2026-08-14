-- AlterTable
ALTER TABLE "TemporaryBlock" ADD COLUMN     "holdGroupId" UUID;

-- CreateIndex
CREATE INDEX "TemporaryBlock_holdGroupId_idx" ON "TemporaryBlock"("holdGroupId");
