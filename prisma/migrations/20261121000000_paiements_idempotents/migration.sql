-- AlterTable
ALTER TABLE "CreditTransaction" ADD COLUMN     "fulfillmentKey" TEXT;

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "CreditTransaction_fulfillmentKey_key" ON "CreditTransaction"("fulfillmentKey");

