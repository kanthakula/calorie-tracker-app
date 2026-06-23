// Client-only "daily logging reminder" preference. Stored in localStorage; no
// push notifications, no service workers, no Notification permission — just an
// in-app banner the user can toggle and dismiss.

const REMIND_KEY = 'k21.remind';

export function getRemind(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(REMIND_KEY) === '1';
  } catch {
    return false;
  }
}

export function setRemind(on: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (on) window.localStorage.setItem(REMIND_KEY, '1');
    else window.localStorage.removeItem(REMIND_KEY);
  } catch {
    /* storage unavailable — ignore */
  }
}
