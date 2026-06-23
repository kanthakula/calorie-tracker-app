-- CreateEnum
CREATE TYPE "DietPattern" AS ENUM ('balanced', 'high_protein', 'low_carb', 'keto', 'mediterranean');

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "dietPattern" "DietPattern" NOT NULL DEFAULT 'balanced';

-- CreateTable
CREATE TABLE "water_days" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "ml" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "water_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_meals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "calories" INTEGER NOT NULL,
    "protein" INTEGER NOT NULL DEFAULT 0,
    "carbs" INTEGER NOT NULL DEFAULT 0,
    "fat" INTEGER NOT NULL DEFAULT 0,
    "health" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_meals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "water_days_userId_date_key" ON "water_days"("userId", "date");

-- CreateIndex
CREATE INDEX "saved_meals_userId_idx" ON "saved_meals"("userId");

-- AddForeignKey
ALTER TABLE "water_days" ADD CONSTRAINT "water_days_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_meals" ADD CONSTRAINT "saved_meals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
