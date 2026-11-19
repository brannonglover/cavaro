import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — Cavaro',
  description: 'Cavaro Privacy Policy. We do not collect, use, or sell your personal data.',
};

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
