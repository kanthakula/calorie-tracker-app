// Daily Summary insight — ported from the original app. Given a day's totals and
// goal, produce a short, friendly suggestion for tomorrow. Pure + deterministic.
import type { Alert, DailyTotals, Targets } from '@k21/validation';

export interface DailyInsight {
  date: string;
  consumed: number;
  goal: number;
  remaining: number;
  avgHealth: number;
  headline: string;
  suggestion: string;
}

export function buildInsight(totals: DailyTotals, goal: number): DailyInsight {
  const { calories: consumed, avgHealth, protein } = totals;
  const remaining = goal - consumed;

  let headline: string;
  if (totals.mealCount === 0) headline = 'No meals logged yet for this day.';
  else if (consumed <= goal) headline = `On track — ${remaining} kcal under your goal.`;
  else headline = `Over goal by ${Math.abs(remaining)} kcal.`;

  const suggestion = buildSuggestion({ consumed, goal, avgHealth, protein });
  return { date: totals.date, consumed, goal, remaining, avgHealth, headline, suggestion };
}

export function buildSuggestion({
  consumed,
  goal,
  avgHealth,
  protein,
}: {
  consumed: number;
  goal: number;
  avgHealth: number;
  protein: number;
}): string {
  if (consumed === 0) return 'Log a meal to get a tailored suggestion for tomorrow.';
  if (consumed > goal * 1.1) {
    return 'You ran over today. Tomorrow, try lighter portions or swap a fried item for something grilled.';
  }
  if (avgHealth > 0 && avgHealth < 2.5) {
    return 'Meals skewed less healthy today. Add a fruit or vegetable to a couple of meals tomorrow.';
  }
  if (protein < 40) {
    return 'Protein was on the low side. Add eggs, dal, yogurt, or chicken tomorrow to stay fuller longer.';
  }
  if (consumed < goal * 0.7) {
    return 'You ate well under your goal. Make sure you are eating enough — add a balanced snack if needed.';
  }
  return 'Nice balance today. Keep the same rhythm tomorrow.';
}

/**
 * Compare a day's totals against the user's targets and produce alerts the UI
 * can color-code (over / under / ok). Empty when no targets are set yet.
 */
export function buildAlerts(totals: DailyTotals, targets: Targets | null): Alert[] {
  if (!targets) return [];
  const alerts: Alert[] = [];
  const logged = totals.mealCount > 0;

  const calT = targets.calorieTarget;
  if (calT > 0 && logged) {
    if (totals.calories > calT * 1.05) {
      alerts.push({
        level: 'over',
        metric: 'calories',
        message: `${totals.calories - calT} kcal over your ${calT} target.`,
      });
    } else if (totals.calories < calT * 0.8) {
      alerts.push({
        level: 'under',
        metric: 'calories',
        message: `${calT - totals.calories} kcal under your target.`,
      });
    } else {
      alerts.push({
        level: 'ok',
        metric: 'calories',
        message: `On target — ${totals.calories} of ${calT} kcal.`,
      });
    }
  }

  if (targets.proteinTarget > 0 && logged) {
    if (totals.protein < targets.proteinTarget * 0.8) {
      alerts.push({
        level: 'under',
        metric: 'protein',
        message: `Protein ${totals.protein} of ${targets.proteinTarget} g — add a protein source.`,
      });
    } else {
      alerts.push({
        level: 'ok',
        metric: 'protein',
        message: `Protein ${totals.protein} of ${targets.proteinTarget} g.`,
      });
    }
  }

  if (targets.fatTarget > 0 && logged && totals.fat > targets.fatTarget * 1.15) {
    alerts.push({
      level: 'over',
      metric: 'fat',
      message: `Fat ${totals.fat} of ${targets.fatTarget} g — running a little high.`,
    });
  }

  return alerts;
}
