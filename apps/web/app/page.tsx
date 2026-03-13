import Link from 'next/link';
import { Suspense } from 'react';
import { GetStartedButton } from './components/GetStartedButton';
import { SubscribeButton } from './components/SubscribeButton';
import { SuccessBanner } from './components/SuccessBanner';
import { DownloadSection } from './components/DownloadSection';

const FREE_CIGAR_LIMIT = 5;

function TierCard({
  title,
  price,
  features,
  cta,
  href,
  highlighted,
  subscribe,
  download,
}: {
  title: string;
  price: string;
  features: string[];
  cta: string;
  href: string;
  highlighted?: boolean;
  subscribe?: boolean;
  download?: boolean;
}) {
  const buttonClass = `mt-8 block w-full rounded-xl py-4 text-center font-semibold transition-colors ${
    highlighted
      ? 'bg-humidor-primary text-humidor-bg hover:bg-humidor-primary-light'
      : 'bg-humidor-border text-humidor-cream hover:bg-humidor-border/80'
  }`;

  return (
    <div
      className={`rounded-xl border-2 p-8 transition-all ${
        highlighted
          ? 'border-humidor-primary bg-humidor-card/80 shadow-lg shadow-humidor-primary/10'
          : 'border-humidor-border bg-humidor-card'
      }`}
    >
      <h3 className="font-sans text-2xl font-semibold text-humidor-cream">{title}</h3>
      <p className="mt-2 font-sans text-3xl font-bold text-humidor-primary">{price}</p>
      <ul className="mt-6 space-y-3">
        {features.map((f, i) => (
          <li key={i} className="flex items-center gap-3 text-humidor-muted">
            <svg
              className="h-5 w-5 shrink-0 text-humidor-like"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {subscribe ? (
        <SubscribeButton className={buttonClass}>{cta}</SubscribeButton>
      ) : download ? (
        <GetStartedButton className={buttonClass}>{cta}</GetStartedButton>
      ) : (
        <Link href={href} className={buttonClass}>
          {cta}
        </Link>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen">
      <Suspense fallback={null}>
        <SuccessBanner />
      </Suspense>
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-10 pb-10 sm:pt-14 sm:pb-14">
        <div className="absolute inset-0 bg-gradient-to-b from-humidor-primary/5 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(196,165,116,0.15),transparent)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <img
            src="/cavaro-logo.png"
            alt="Cavaro"
            className="mx-auto h-auto w-[35rem] max-w-full"
          />
          <p className="mt-2 text-xl text-humidor-muted sm:text-2xl">
            Your personal cigar companion
          </p>
        </div>
      </section>

      {/* About */}
      <section className="px-6 pb-10">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-sans text-2xl font-semibold text-humidor-cream sm:text-3xl">
            Why Cavaro?
          </h2>
          <div className="mt-4 space-y-3 text-lg leading-relaxed text-humidor-muted">
            <p>
              Every cigar enthusiast deserves a place to track their collection, remember what they
              loved, and discover the perfect drink to pair with their next smoke.
            </p>
            <p>
              Cavaro helps you catalog your cigars, log tasting notes, track strength profiles
              across first, second, and final thirds—and with Premium, get AI-powered drink pairing
              suggestions that elevate every session.
            </p>
          </div>

          {/* Benefits */}
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <div className="flex flex-col items-center text-center">
              <div className="rounded-full bg-humidor-card p-4 ring-1 ring-humidor-border">
                <svg
                  className="h-8 w-8 text-humidor-primary"
                  viewBox="0 0 32 32"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <rect x={4} y={2} width={24} height={10} rx={3} ry={3} />
                  <rect x={4} y={16} width={24} height={10} rx={3} ry={3} />
                </svg>
              </div>
              <p className="mt-2 font-medium text-humidor-cream">Track your collection</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="rounded-full bg-humidor-card p-4 ring-1 ring-humidor-border">
                <svg
                  className="h-8 w-8 text-humidor-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                  />
                </svg>
              </div>
              <p className="mt-2 font-medium text-humidor-cream">Favorites & notes</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="rounded-full bg-humidor-card p-4 ring-1 ring-humidor-border">
                <svg
                  className="h-8 w-8 text-humidor-primary"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M7.5,7L5.5,5H18.5L16.5,7M11,13V19H6V21H18V19H13V13L21,5V3H3V5L11,13Z" />
                </svg>
              </div>
              <p className="mt-2 font-medium text-humidor-cream">Drink pairings</p>
            </div>
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 font-sans text-2xl font-semibold text-humidor-cream sm:text-3xl">
            Choose your plan
          </h2>
          <div className="grid gap-8 sm:grid-cols-2">
            <TierCard
              title="Free"
              price="Try it free"
              features={[
                `Add up to ${FREE_CIGAR_LIMIT} cigars`,
                'Track favorites and dislikes',
                'Tasting notes & strength profiles',
              ]}
              cta="Get started"
              href="#download"
              download
            />
            <TierCard
              title="Premium"
              price="$4.99/mo"
              features={[
                'Unlimited cigars',
                'AI-powered drink pairing',
                'All features unlocked',
              ]}
              cta="Subscribe"
              href="#download"
              highlighted
              subscribe
            />
          </div>

          <p className="mt-12 text-center text-humidor-muted">
            Download the app to sign up and get started. Premium subscribers get unlimited cigars and
            AI-powered drink pairing suggestions.
          </p>

          <DownloadSection />
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
            © {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </main>
  );
}