// Shared design tokens. Green -> orange health palette, plain RN StyleSheet.
export const colors = {
  // Brand greens (healthy)
  green: '#16a34a',
  greenDark: '#15803d',
  greenSoft: '#dcfce7',
  // Brand oranges (indulgent / accent)
  orange: '#ea580c',
  orangeSoft: '#ffedd5',
  // Health scale 1..5 (red -> orange -> amber -> lime -> green)
  health: ['#dc2626', '#f97316', '#f59e0b', '#84cc16', '#16a34a'] as const,
  // Surfaces / text
  bg: '#f8faf9',
  card: '#ffffff',
  border: '#e5e7eb',
  text: '#111827',
  textMuted: '#6b7280',
  textFaint: '#9ca3af',
  danger: '#dc2626',
  dangerSoft: '#fee2e2',
  white: '#ffffff',
};

/** Accent colour for a 0..5 health value (0 = unrated/grey). */
export function healthColor(health: number): string {
  if (health <= 0) return colors.textFaint;
  const idx = Math.min(5, Math.max(1, Math.round(health))) - 1;
  return colors.health[idx];
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};

export const font = {
  h1: 26,
  h2: 20,
  h3: 17,
  body: 15,
  small: 13,
  tiny: 11,
};
