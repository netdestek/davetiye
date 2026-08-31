import type { Metadata } from 'next';
import { DM_Sans, Playfair_Display } from 'next/font/google';
import './globals.css';

const dmSans = DM_Sans({ variable: '--font-dm-sans', subsets: ['latin', 'latin-ext'] });
const playfair = Playfair_Display({ variable: '--font-playfair', subsets: ['latin', 'latin-ext'] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: 'Davetly — Dijital davetiyen, tüm güzel anların',
  description: 'Video davetiyeni hazırla, WhatsApp üzerinden paylaş ve katılım yanıtlarını tek ekrandan takip et.',
  openGraph: {
    title: 'Davetly — Dijital davetiyen, tüm güzel anların',
    description: 'Davetiyeni hazırla. WhatsApp’tan paylaş. Katılımı tek ekrandan takip et.',
    type: 'website',
    locale: 'tr_TR',
    siteName: 'Davetly',
    images: [{ url: '/og.png', width: 1734, height: 907, alt: 'Davetly dijital davetiye platformu' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Davetly — Dijital davetiyen, tüm güzel anların',
    description: 'Davetiyeni hazırla. WhatsApp’tan paylaş. Katılımı tek ekrandan takip et.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body className={`${dmSans.variable} ${playfair.variable} antialiased`}>{children}</body>
    </html>
  );
}
