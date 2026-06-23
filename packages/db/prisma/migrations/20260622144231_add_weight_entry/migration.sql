-- AlterTable
ALTER TABLE "app_settings" ALTER COLUMN "featBarcode" SET DEFAULT true,
ALTER COLUMN "featWorkouts" SET DEFAULT true;

-- CreateTable
CREATE TABLE "weight_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weight_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "weight_entries_userId_date_idx" ON "weight_entries"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "weight_entries_userId_date_key" ON "weight_entries"("userId", "date");

-- AddForeignKey
ALTER TABLE "weight_entries" ADD CONSTRAINT "weight_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
