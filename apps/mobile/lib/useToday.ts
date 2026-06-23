// Shared "selected day" state so the Add/Snap tabs add meals to the same date
// the user is viewing on the Today tab. Backed by a tiny module-level store.
import { useEffect, useState } from 'react';
import { todayIso } from './date';

let current = todayIso();
const listeners = new Set<(d: string) => void>();

export function getSelectedDate(): string {
  return current;
}

export function setSelectedDate(date: string): void {
  current = date;
  listeners.forEach((l) => l(date));
}

/** Subscribe to the shared selected date. */
export function useSelectedDate(): [string, (d: string) => void] {
  const [date, setDate] = useState(current);
  useEffect(() => {
    const listener = (d: string) => setDate(d);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return [date, setSelectedDate];
}
