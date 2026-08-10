'use client';

import Link from 'next/link';
import { useState } from 'react';

const SUPPORT_EMAIL = 'support@cavaroapp.com';

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const subject = formData.get('subject') as string;
    const message = formData.get('message') as string;

    const body = [
      `Name: ${name}`,
      `Email: ${email}`,
      '',
      message,
    ].join('\n');

    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject || 'Contact from Cavaro')}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    setSubmitted(true);
  }

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-10 pb-10 sm:pt-14 sm:pb-12">
        <div className="absolute inset-0 bg-gradient-to-b from-humidor-primary/5 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(196,165,116,0.15),transparent)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <h1 className="font-sans text-3xl font-semibold text-humidor-cream sm:text-4xl">
            Get in touch
          </h1>
          <p className="mt-2 text-lg text-humidor-muted">
            Have a question or feedback? We&apos;d love to hear from you.
          </p>
        </div>
      </section>

      {/* Contact form */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-xl">
          <div className="rounded-xl border-2 border-humidor-border bg-humidor-card p-8 shadow-lg">
            {submitted ? (
              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-humidor-primary/20">
                  <svg
                    className="h-8 w-8 text-humidor-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <h2 className="mt-4 font-sans text-xl font-semibold text-humidor-cream">
                  Check your email client
                </h2>
                <p className="mt-2 text-humidor-muted">
                  Your default email app should open with the message ready to send. If it
                  didn&apos;t, you can email us directly at{' '}
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="text-humidor-primary hover:underline"
                  >
                    {SUPPORT_EMAIL}
                  </a>
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="mt-6 rounded-xl border border-humidor-border bg-humidor-bg px-6 py-3 text-humidor-cream transition-colors hover:border-humidor-primary"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-humidor-cream">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    className="mt-2 w-full rounded-xl border-2 border-humidor-border bg-humidor-bg px-4 py-3 text-humidor-cream placeholder-humidor-muted/60 outline-none transition-colors focus:border-humidor-primary"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-humidor-cream">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    className="mt-2 w-full rounded-xl border-2 border-humidor-border bg-humidor-bg px-4 py-3 text-humidor-cream placeholder-humidor-muted/60 outline-none transition-colors focus:border-humidor-primary"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-humidor-cream">
                    Subject
                  </label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    className="mt-2 w-full rounded-xl border-2 border-humidor-border bg-humidor-bg px-4 py-3 text-humidor-cream placeholder-humidor-muted/60 outline-none transition-colors focus:border-humidor-primary"
                    placeholder="How can we help?"
                  />
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-humidor-cream">
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={5}
                    className="mt-2 w-full resize-y rounded-xl border-2 border-humidor-border bg-humidor-bg px-4 py-3 text-humidor-cream placeholder-humidor-muted/60 outline-none transition-colors focus:border-humidor-primary"
                    placeholder="Tell us what's on your mind..."
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-humidor-primary py-4 font-semibold text-humidor-bg transition-colors hover:bg-humidor-primary-light"
                >
                  Send message
                </button>
              </form>
            )}
          </div>

          <p className="mt-6 text-center text-sm text-humidor-muted">
            Or email us directly at{' '}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-humidor-primary hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-humidor-border px-6 py-8">
        <div className="mx-auto max-w-4xl text-center text-sm text-humidor-subtle">
          <p>Cavaro — Your personal cigar companion</p>
          <p className="mt-1">
            <Link href="/contact" className="text-humidor-primary hover:underline">
              Contact us
            </Link>
            {' · '}
            <Link href="/privacy" className="text-humidor-primary hover:underline">
              Privacy Policy
            </Link>
            {' · '}
            <Link href="/terms" className="text-humidor-primary hover:underline">
              Terms of Use
            </Link>
            {' · '}
            <Link href="/delete-account" className="text-humidor-primary hover:underline">
              Delete account
            </Link>
            {' · '}
            © {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </main>
  );
}
