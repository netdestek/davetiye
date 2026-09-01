import type { Metadata } from 'next';
import { Inter, Inter_Tight, Playfair_Display } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
});
const interTight = Inter_Tight({
  variable: '--font-inter-tight',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
});
const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  ),
  title: 'Davetly — Dijital davetiyen, tüm güzel anların',
  description:
    'Hazır videonu seç, WhatsApp üzerinden paylaş ve katılım yanıtlarını tek ekrandan takip et.',
  openGraph: {
    title: 'Davetly — Dijital davetiyen, tüm güzel anların',
    description:
      'Davetiyeni hazırla. WhatsApp’tan paylaş. Katılımı tek ekrandan takip et.',
    type: 'website',
    locale: 'tr_TR',
    siteName: 'Davetly',
    images: [
      {
        url: '/og.png',
        width: 1734,
        height: 907,
        alt: 'Davetly dijital davetiye platformu',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Davetly — Dijital davetiyen, tüm güzel anların',
    description:
      'Davetiyeni hazırla. WhatsApp’tan paylaş. Katılımı tek ekrandan takip et.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body
        className={`${inter.variable} ${interTight.variable} ${playfair.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
