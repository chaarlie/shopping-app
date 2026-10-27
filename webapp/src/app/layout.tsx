import { CheckoutSettingsProvider } from '@/lib/checkout-settings';
import { Suspense } from 'react';
import Header from './components/header';
import Footer from './components/footer';
import type { Metadata } from 'next';
import { Inter_Tight } from 'next/font/google';
import './globals.css';

const interTight = Inter_Tight({
  variable: '--font-inter-tight',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Stockroom',
  description: 'Everyday essentials. A demo store with simulated payments.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={interTight.variable}>
      <body>
        <CheckoutSettingsProvider>
          <div className="wrap">
            <a className="skip-link" href="#main">
              Skip to content
            </a>
            <Suspense>
              <Header />
            </Suspense>
            <main id="main">
              <Suspense fallback={<p role="status">Loading…</p>}>
                {children}
              </Suspense>
            </main>
            <Footer />
          </div>
        </CheckoutSettingsProvider>
      </body>
    </html>
  );
}
