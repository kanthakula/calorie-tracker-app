-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "appName" TEXT NOT NULL DEFAULT 'K21 Calorie Tracker',
    "tagline" TEXT NOT NULL DEFAULT 'Track food. Hit your targets.',
    "logoEmoji" TEXT NOT NULL DEFAULT '🍳',
    "defaultTheme" TEXT NOT NULL DEFAULT 'system',
    "accentColor" TEXT NOT NULL DEFAULT '#039855',
    "accentColor2" TEXT NOT NULL DEFAULT '#12b76a',
    "featAiSnap" BOOLEAN NOT NULL DEFAULT true,
    "featFoodLibrary" BOOLEAN NOT NULL DEFAULT true,
    "featBarcode" BOOLEAN NOT NULL DEFAULT false,
    "featWorkouts" BOOLEAN NOT NULL DEFAULT false,
    "featWater" BOOLEAN NOT NULL DEFAULT false,
    "extra" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);
