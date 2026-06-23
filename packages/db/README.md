# @k21/db

Prisma schema, generated client, and seed for the K21 Postgres database.

```ts
import { prisma } from '@k21/db';

const meals = await prisma.meal.findMany({ where: { userId, date: '2026-06-20' } });
```

## Models
- **User** — accounts (email, name, bcrypt hash set by the Node API).
- **Meal** — logged meals (`date` is ISO `YYYY-MM-DD`; macros + `health` + `source`).
- **DailyGoal** — calorie goals; `date = null` is the standing default.
- **FoodItem** — the shared predefined food library (read-only catalog).

## Workflow
```bash
pnpm db:generate     # regenerate the Prisma client after schema changes
pnpm db:migrate      # create/apply a dev migration
pnpm db:seed         # load the food library + a demo user
pnpm db:studio       # open Prisma Studio
```

`DATABASE_URL` is read from the repo-root `.env` (see `.env.example`). Start
Postgres first with `pnpm docker:up`.
