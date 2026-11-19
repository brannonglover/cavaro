'use client';

import Link from 'next/link';

export default function SuccessPage() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-10 pb-10 sm:pt-14 sm:pb-12">
        <div className="absolute inset-0 bg-gradient-to-b from-humidor-primary/5 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(196,165,116,0.15),transparent)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <h1 className="font-sans text-3xl font-semibold text-humidor-cream sm:text-4xl">
            Email confirmed
          </h1>
          <p className="mt-2 text-lg text-humidor-muted">
            Your account is ready. You can now sign in to the Cavaro app.
          </p>
        </div>
      </section>

      {/* Success card */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-xl">
          <div className="rounded-xl border-2 border-humidor-border bg-humidor-card p-8 shadow-lg">
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-humidor-primary/20">
                <svg
                  className="h-10 w-10 text-humidor-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="mt-6 font-sans text-xl font-semibold text-humidor-cream">
                You&apos;re all set
              </h2>
              <p className="mt-2 text-humidor-muted">
                Open the Cavaro app and sign in with the email you just verified.
              </p>
              <Link
                href="/#download"
                className="mt-8 inline-block rounded-xl bg-humidor-primary px-8 py-3 font-semibold text-humidor-bg transition-colors hover:bg-humidor-primary-light"
              >
                Download the app
              </Link>
              <p className="mt-6">
                <Link href="/" className="text-humidor-primary hover:underline">
                  ← Back to home
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
