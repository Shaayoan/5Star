import type { Metadata, Viewport } from 'next';
import { Inter, Sora } from 'next/font/google';
import { CelebrateProvider } from '@/components/Celebrate';
import './globals.css';

const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const display = Sora({ subsets: ['latin'], variable: '--font-display', display: 'swap' });

export const metadata: Metadata = {
  title: '5 Star — be a five star human',
  description:
    'Pick the five pillars that matter to you, log them daily, and get a weekly report on how balanced your life actually is.',
};

export const viewport: Viewport = {
  themeColor: '#07090f',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="font-sans antialiased">
        <CelebrateProvider>{children}</CelebrateProvider>
      </body>
    </html>
  );
}
