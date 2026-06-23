// Seeds the predefined food library and a demo user.
// Run with: pnpm db:seed   (idempotent — safe to run repeatedly)
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// f(name, category, serving, calories, protein, carbs, fat)
type Seed = {
  name: string;
  category: string;
  serving: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};
const f = (
  name: string,
  category: string,
  serving: string,
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
): Seed => ({ name, category, serving, calories, protein, carbs, fat });

const FOODS: Seed[] = [
  // --- Fruits ---
  f('Apple', 'Fruits', '1 medium', 95, 0, 25, 0),
  f('Banana', 'Fruits', '1 medium', 105, 1, 27, 0),
  f('Orange', 'Fruits', '1 medium', 62, 1, 15, 0),
  f('Grapes', 'Fruits', '1 cup', 104, 1, 27, 0),
  f('Mango', 'Fruits', '1 cup', 99, 1, 25, 1),
  f('Strawberries', 'Fruits', '1 cup', 49, 1, 12, 0),
  f('Watermelon', 'Fruits', '1 cup', 46, 1, 12, 0),
  f('Pineapple', 'Fruits', '1 cup', 82, 1, 22, 0),

  // --- Vegetables ---
  f('Broccoli', 'Vegetables', '1 cup', 55, 4, 11, 1),
  f('Carrot', 'Vegetables', '1 medium', 25, 1, 6, 0),
  f('Spinach', 'Vegetables', '1 cup', 7, 1, 1, 0),
  f('Boiled Potato', 'Vegetables', '1 medium', 130, 3, 30, 0),
  f('Sweet Potato', 'Vegetables', '1 medium', 112, 2, 26, 0),
  f('Tomato', 'Vegetables', '1 medium', 22, 1, 5, 0),
  f('Cucumber', 'Vegetables', '1 cup', 16, 1, 4, 0),
  f('Corn', 'Vegetables', '1 cup', 132, 5, 29, 2),

  // --- Grains & Bread ---
  f('White Rice (cooked)', 'Grains & Bread', '1 cup', 205, 4, 45, 0),
  f('Brown Rice (cooked)', 'Grains & Bread', '1 cup', 216, 5, 45, 2),
  f('Roti / Chapati', 'Grains & Bread', '1 piece', 120, 3, 18, 4),
  f('White Bread', 'Grains & Bread', '1 slice', 79, 3, 14, 1),
  f('Whole Wheat Bread', 'Grains & Bread', '1 slice', 81, 4, 14, 1),
  f('Oatmeal', 'Grains & Bread', '1 cup', 154, 6, 27, 3),
  f('Pasta (cooked)', 'Grains & Bread', '1 cup', 220, 8, 43, 1),
  f('Quinoa (cooked)', 'Grains & Bread', '1 cup', 222, 8, 39, 4),

  // --- Proteins ---
  f('Grilled Chicken Breast', 'Proteins', '100 g', 165, 31, 0, 4),
  f('Boiled Egg', 'Proteins', '1 large', 78, 6, 1, 5),
  f('Paneer', 'Proteins', '100 g', 265, 18, 6, 21),
  f('Tofu', 'Proteins', '100 g', 76, 8, 2, 5),
  f('Salmon', 'Proteins', '100 g', 208, 20, 0, 13),
  f('Dal / Lentils (cooked)', 'Proteins', '1 cup', 230, 18, 40, 1),
  f('Chickpeas (cooked)', 'Proteins', '1 cup', 269, 15, 45, 4),
  f('Lean Beef (cooked)', 'Proteins', '100 g', 250, 26, 0, 15),

  // --- Dairy ---
  f('Whole Milk', 'Dairy', '1 cup', 149, 8, 12, 8),
  f('Skim Milk', 'Dairy', '1 cup', 83, 8, 12, 0),
  f('Greek Yogurt', 'Dairy', '1 cup', 100, 17, 6, 0),
  f('Cheddar Cheese', 'Dairy', '1 slice', 113, 7, 0, 9),
  f('Butter', 'Dairy', '1 tbsp', 102, 0, 0, 12),
  f('Curd / Yogurt', 'Dairy', '1 cup', 98, 11, 12, 0),

  // --- Indian ---
  f('Plain Dosa', 'Indian', '1', 168, 4, 29, 4),
  f('Idli', 'Indian', '2 pieces', 78, 3, 16, 0),
  f('Chicken Biryani', 'Indian', '1 cup', 290, 12, 30, 13),
  f('Veg Biryani', 'Indian', '1 cup', 240, 6, 36, 8),
  f('Samosa', 'Indian', '1', 262, 4, 24, 17),
  f('Paneer Butter Masala', 'Indian', '1 cup', 350, 12, 16, 26),
  f('Dal Tadka', 'Indian', '1 cup', 180, 9, 24, 6),
  f('Chole', 'Indian', '1 cup', 270, 12, 40, 8),
  f('Naan', 'Indian', '1', 260, 9, 48, 5),
  f('Poha', 'Indian', '1 cup', 250, 5, 45, 6),

  // --- Snacks ---
  f('Potato Chips', 'Snacks', '1 oz (28 g)', 152, 2, 15, 10),
  f('Popcorn', 'Snacks', '1 cup', 31, 1, 6, 0),
  f('Granola Bar', 'Snacks', '1 bar', 132, 3, 18, 5),
  f('Cookies', 'Snacks', '2', 140, 2, 20, 6),
  f('Peanuts', 'Snacks', '1 oz', 161, 7, 5, 14),
  f('Mixed Nuts', 'Snacks', '1 oz', 173, 5, 6, 15),

  // --- Fast Food ---
  f('Burger', 'Fast Food', '1', 354, 17, 30, 18),
  f('Pizza Slice', 'Fast Food', '1 slice', 285, 12, 36, 10),
  f('French Fries', 'Fast Food', 'medium', 365, 4, 48, 17),
  f('Hot Dog', 'Fast Food', '1', 290, 10, 24, 18),
  f('Fried Chicken', 'Fast Food', '1 piece', 320, 22, 8, 22),
  f('Sandwich', 'Fast Food', '1', 250, 12, 30, 9),

  // --- Beverages ---
  f('Black Coffee', 'Beverages', '1 cup', 2, 0, 0, 0),
  f('Tea (milk & sugar)', 'Beverages', '1 cup', 60, 1, 10, 2),
  f('Orange Juice', 'Beverages', '1 cup', 112, 2, 26, 0),
  f('Cola', 'Beverages', '1 can', 140, 0, 39, 0),
  f('Beer', 'Beverages', '1 can', 154, 2, 13, 0),
  f('Sweet Lassi', 'Beverages', '1 cup', 180, 6, 30, 4),
  f('Milkshake', 'Beverages', '1 cup', 250, 8, 40, 8),

  // --- Sweets ---
  f('Gulab Jamun', 'Sweets', '1', 150, 2, 25, 5),
  f('Chocolate Bar', 'Sweets', '1 (44 g)', 235, 3, 26, 13),
  f('Ice Cream', 'Sweets', '1 scoop', 137, 2, 16, 7),
  f('Donut', 'Sweets', '1', 195, 2, 22, 11),
  f('Rasgulla', 'Sweets', '1', 106, 2, 20, 2),
  f('Jalebi', 'Sweets', '1', 150, 1, 25, 5),

  // --- Nuts & Seeds ---
  f('Almonds', 'Nuts & Seeds', '1 oz (23 nuts)', 164, 6, 6, 14),
  f('Walnuts', 'Nuts & Seeds', '1 oz', 185, 4, 4, 18),
  f('Cashews', 'Nuts & Seeds', '1 oz', 157, 5, 9, 12),
  f('Chia Seeds', 'Nuts & Seeds', '1 tbsp', 58, 2, 5, 4),
  f('Peanut Butter', 'Nuts & Seeds', '1 tbsp', 94, 4, 3, 8),
];

async function main() {
  // 1) Food library — upsert by (name, category) so re-seeding is idempotent.
  for (const item of FOODS) {
    await prisma.foodItem.upsert({
      where: { name_category: { name: item.name, category: item.category } },
      update: item,
      create: item,
    });
  }
  console.log(`Seeded ${FOODS.length} food-library items.`);

  // 2) Demo user + default goal. Hash with bcrypt so the real login works.
  const passwordHash = await bcrypt.hash('demo1234', 12);
  const demo = await prisma.user.upsert({
    where: { email: 'demo@akulaz.local' },
    update: { passwordHash },
    create: {
      email: 'demo@akulaz.local',
      name: 'Demo User',
      passwordHash,
    },
  });
  // A compound unique that includes a nullable column (date) can't be addressed
  // via upsert when date is null, so find-then-create the standing default goal.
  const existingGoal = await prisma.dailyGoal.findFirst({
    where: { userId: demo.id, date: null },
  });
  if (existingGoal) {
    await prisma.dailyGoal.update({ where: { id: existingGoal.id }, data: { calorieGoal: 2000 } });
  } else {
    await prisma.dailyGoal.create({ data: { userId: demo.id, date: null, calorieGoal: 2000 } });
  }
  console.log('Seeded demo user (demo@akulaz.local / demo1234) with a 2000 kcal default goal.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
