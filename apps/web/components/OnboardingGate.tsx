'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getProfile } from '@/lib/api';
import { ONBOARDED_FLAG, isProfileNew } from '@/lib/onboarding';

/**
 * Auto-trigger onboarding: on the home page, a logged-in user with no profile
 * stats is sent to the wizard. A localStorage flag short-circuits the check for
 * everyone who's already set up, so established users pay no extra fetch.
 */
export function OnboardingGate() {
  const router = useRouter();

  useEffect(() => {
    try {
      if (window.localStorage.getItem(ONBOARDED_FLAG)) return;
    } catch {
      // localStorage unavailable — fall through to the check.
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await getProfile();
        if (cancelled) return;
        if (isProfileNew(res.profile)) {
          router.replace('/onboarding');
        } else {
          try {
            window.localStorage.setItem(ONBOARDED_FLAG, '1');
          } catch {
            /* non-critical */
          }
        }
      } catch {
        // Non-critical — never block the app on this check.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
