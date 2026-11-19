import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'News — Cavaro',
  description:
    'Product updates, feature launches, and announcements from the Cavaro team.',
};

export default function NewsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
