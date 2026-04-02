import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Use — Cavaro',
  description: 'Cavaro Terms of Use. Please read these terms carefully before using the app.',
};

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
