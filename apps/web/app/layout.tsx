import type { Metadata, Viewport } from 'next';
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { SettingsProvider } from '@/lib/settings';
import { BottomNav } from '@/components/BottomNav';

// ---- Typography (self-hosted via next/font) ----
// Display: a confident geometric grotesk for headings + brand.
const display = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

// Body: Inter for prose and UI text.
const body = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

// Numbers/data: a monospace for the instrument-style numeric readouts.
const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-mono',
  display: 'swap',
});

// The browser-tab title follows the owner-configurable app name. We read the
// PUBLIC settings server-side so the very first paint is correct (no flash);
// SettingsProvider also keeps document.title in sync after hydration.
const DEFAULT_NAME = 'Ojas';

export async function generateMetadata(): Promise<Metadata> {
  let name = DEFAULT_NAME;
  try {
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${base}/api/settings`, {
      signal: controller.signal,
      // Always reflect the current configured name (cheap public endpoint).
      cache: 'no-store',
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = (await res.json()) as { appName?: unknown };
      if (typeof data.appName === 'string' && data.appName.trim()) {
        name = data.appName.trim();
      }
    }
  } catch {
    // API unreachable (e.g. during build) — fall back to the default name.
  }
  return {
    title: name,
    description:
      'Log meals, track calories and macros, and get a daily health insight.',
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1A1614',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <body>
        <a href="#main" className="sr-only">
          Skip to main content
        </a>
        <SettingsProvider>
          <AuthProvider>
            {children}
            <BottomNav />
          </AuthProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
