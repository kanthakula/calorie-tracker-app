-- CreateTable
CREATE TABLE "fast_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "targetHours" INTEGER NOT NULL DEFAULT 16,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fast_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fast_sessions_userId_startAt_idx" ON "fast_sessions"("userId", "startAt");

-- AddForeignKey
ALTER TABLE "fast_sessions" ADD CONSTRAINT "fast_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
