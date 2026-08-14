-- AlterTable
ALTER TABLE "User" ADD COLUMN     "alexaSeed" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_alexaSeed_key" ON "User"("alexaSeed");

