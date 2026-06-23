import { prisma } from '@k21/db';
import type { AppSettings, UpdateAppSettings } from '@k21/validation';

const ID = 'singleton';

type SettingsRow = {
  appName: string;
  tagline: string;
  logoEmoji: string;
  defaultTheme: string;
  accentColor: string;
  accentColor2: string;
  featAiSnap: boolean;
  featFoodLibrary: boolean;
  featBarcode: boolean;
  featWorkouts: boolean;
  featWater: boolean;
};

function toAppSettings(row: SettingsRow): AppSettings {
  return {
    appName: row.appName,
    tagline: row.tagline,
    logoEmoji: row.logoEmoji,
    defaultTheme: row.defaultTheme as AppSettings['defaultTheme'],
    accentColor: row.accentColor,
    accentColor2: row.accentColor2,
    features: {
      aiSnap: row.featAiSnap,
      foodLibrary: row.featFoodLibrary,
      barcode: row.featBarcode,
      workouts: row.featWorkouts,
      water: row.featWater,
    },
  };
}

export async function getSettings(): Promise<AppSettings> {
  let row = await prisma.appSettings.findUnique({ where: { id: ID } });
  if (!row) row = await prisma.appSettings.create({ data: { id: ID } });
  return toAppSettings(row);
}

export async function updateSettings(input: UpdateAppSettings): Promise<AppSettings> {
  const data: Record<string, unknown> = {};
  if (input.appName !== undefined) data.appName = input.appName;
  if (input.tagline !== undefined) data.tagline = input.tagline;
  if (input.logoEmoji !== undefined) data.logoEmoji = input.logoEmoji;
  if (input.defaultTheme !== undefined) data.defaultTheme = input.defaultTheme;
  if (input.accentColor !== undefined) data.accentColor = input.accentColor;
  if (input.accentColor2 !== undefined) data.accentColor2 = input.accentColor2;
  if (input.features) {
    const f = input.features;
    if (f.aiSnap !== undefined) data.featAiSnap = f.aiSnap;
    if (f.foodLibrary !== undefined) data.featFoodLibrary = f.foodLibrary;
    if (f.barcode !== undefined) data.featBarcode = f.barcode;
    if (f.workouts !== undefined) data.featWorkouts = f.workouts;
    if (f.water !== undefined) data.featWater = f.water;
  }

  const row = await prisma.appSettings.upsert({
    where: { id: ID },
    update: data,
    create: { id: ID, ...data },
  });
  return toAppSettings(row);
}
