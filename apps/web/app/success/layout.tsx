import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Email confirmed — Cavaro',
  description: 'Your Cavaro account email has been verified. Sign in to the app to get started.',
};

export default function SuccessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
