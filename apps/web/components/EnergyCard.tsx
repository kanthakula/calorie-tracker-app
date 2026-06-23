'use client';

import Link from 'next/link';
import type { DailyEnergy } from '@k21/validation';
import { MISC_EMOJI } from '@/lib/emoji';
import styles from './EnergyCard.module.css';

interface Props {
  energy: DailyEnergy;
}

/**
 * Energy-balance tile: Active burn 🔥, Resting (BMR), Intake, and the Net
 * (intake − resting − active) with a deficit/surplus label. When resting burn is
 * unknown (profile lacks age/height/weight for a BMR), we still show intake +
 * active and gently prompt the user to complete their profile.
 */
export function EnergyCard({ energy }: Props) {
  const { intake, burned, restingBurn, net } = energy;
  const hasNet = net != null;
  // Negative net = under maintenance (deficit, good); positive = surplus.
  const deficit = hasNet && net < 0;

  return (
    <section className={`card ${styles.card}`} aria-labelledby="energy-heading">
      <h2 id="energy-heading" className={styles.heading}>
        <span aria-hidden="true">⚖️</span> Energy balance
      </h2>

      <dl className={styles.rows}>
        <div className={styles.row}>
          <dt className={styles.term}>
            <span aria-hidden="true">🍽️</span> Intake
          </dt>
          <dd className={styles.value}>
            <span className="num">{intake.toLocaleString()}</span>
            <span className={styles.unit}>kcal</span>
          </dd>
        </div>

        <div className={styles.row}>
          <dt className={styles.term}>
            <span aria-hidden="true">😴</span> Resting (BMR)
          </dt>
          <dd className={styles.value}>
            {restingBurn != null ? (
              <>
                <span className={styles.minus} aria-hidden="true">
                  −
                </span>
                <span className="num">{restingBurn.toLocaleString()}</span>
                <span className={styles.unit}>kcal</span>
              </>
            ) : (
              <span className={styles.dash} aria-label="unknown">
                —
              </span>
            )}
          </dd>
        </div>

        <div className={styles.row}>
          <dt className={styles.term}>
            <span aria-hidden="true">{MISC_EMOJI.calories}</span> Active burn
          </dt>
          <dd className={styles.value}>
            <span className={styles.minus} aria-hidden="true">
              −
            </span>
            <span className="num">{burned.toLocaleString()}</span>
            <span className={styles.unit}>kcal</span>
          </dd>
        </div>
      </dl>

      {hasNet ? (
        <div
          className={`${styles.net} ${deficit ? styles.netDeficit : styles.netSurplus}`}
        >
          <span className={styles.netLabel}>Net</span>
          <span className={`num ${styles.netValue}`}>
            {net > 0 ? '+' : ''}
            {net.toLocaleString()}
          </span>
          <span className={styles.netTag}>
            {deficit ? 'deficit ✅ under maintenance' : 'surplus'}
          </span>
        </div>
      ) : (
        <p className={styles.prompt}>
          <Link href="/profile" className={styles.promptLink}>
            Add your age/height/weight in Profile to see resting burn &amp; net
            calories →
          </Link>
        </p>
      )}
    </section>
  );
}
