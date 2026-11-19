import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Delete Account — Cavaro',
  description:
    'How to delete your Cavaro account and associated data. Request account deletion in the app or by emailing support.',
};

export default function DeleteAccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
