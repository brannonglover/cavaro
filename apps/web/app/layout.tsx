import type { Metadata } from 'next';
import Header from './components/Header';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cavaro — Your Personal Cigar Companion',
  description:
    'Manage your humidor, journal your smokes, understand your palate, and choose your next cigar with confidence. Free and Premium tiers available.',
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