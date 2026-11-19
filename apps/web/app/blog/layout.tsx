import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog — Cavaro',
  description:
    'Cigar tips, tasting advice, and collector insights from the Cavaro team. Learn how to journal smarter and get more from every smoke.',
};

export default function BlogLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
