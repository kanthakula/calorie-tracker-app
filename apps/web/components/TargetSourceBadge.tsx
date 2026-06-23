'use client';

import type { TargetSource } from '@/lib/types';
import styles from './TargetSourceBadge.module.css';

const META: Record<TargetSource, { label: string; title: string; tone: string }> = {
  adaptive: {
    label: 'Adaptive',
    title: 'Targets are measured from your logged intake + weight trend.',
    tone: 'adaptive',
  },
  estimated: {
    label: 'Estimated',
    title: 'Targets are estimated (Mifflin-St Jeor). Log ~2 weeks + a few weigh-ins to unlock adaptive.',
    tone: 'estimated',
  },
  manual: {
    label: 'Manual',
    title: 'You set these targets manually.',
    tone: 'manual',
  },
};

/** Small "🎯 Adaptive / Estimated / Manual" pill for the target source. */
export function TargetSourceBadge({ source }: { source: TargetSource }) {
  const m = META[source];
  return (
    <span className={`${styles.badge} ${styles[m.tone]}`} title={m.title}>
      <span aria-hidden="true">🎯</span>
      <span className="sr-only">Target source: </span>
      {m.label}
    </span>
  );
}
