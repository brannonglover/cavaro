import type { Metadata } from 'next';
import Header from './components/Header';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cavaro — Your Personal Cigar Companion',
  description:
    'Manage your humidor, journal your smokes, understand your palate, and choose your next cigar with confidence. Free and Premium tiers available.',
  metadataBase: new URL('https://cavaroapp.com'),
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-48.png', sizes: '48x48', type: 'image/png' },
      { url: '/favicon-96.png', sizes: '96x96', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Header />
        <div className="pt-[68px]">{children}</div>
      </body>
    </html>
  );
}