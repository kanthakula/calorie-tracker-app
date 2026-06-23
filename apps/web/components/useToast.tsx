'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Minimal transient toast. Returns the current message + a `show` function. */
export function useToast(timeoutMs = 2400) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (msg: string) => {
      setMessage(msg);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMessage(null), timeoutMs);
    },
    [timeoutMs],
  );

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const node = message ? (
    <div className="toast" role="status" aria-live="polite">
      {message}
    </div>
  ) : null;

  return { show, node };
}
