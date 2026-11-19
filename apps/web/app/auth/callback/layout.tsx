import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Account — Cavaro',
  description: 'Complete email verification or reset your Cavaro password.',
};

export default function AuthCallbackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
