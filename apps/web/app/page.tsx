import Link from 'next/link';

const FREE_CIGAR_LIMIT = 5;

function TierCard({
  title,
  price,
  features,
  cta,
  href,
  highlighted,
}: {
  title: string;
  price: string;
  features: string[];
  cta: string;
  href: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border-2 p-8 transition-all ${
        highlighted
          ? 'border-humidor-primary bg-humidor-card/80 shadow-lg shadow-humidor-primary/10'
          : 'border-humidor-border bg-humidor-card'
      }`}
    >
      <h3 className="font-serif text-2xl font-semibold text-humidor-cream">{title}</h3>
      <p className="mt-2 font-serif text-3xl font-bold text-humidor-primary">{price}</p>
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
      <Link
        href={href}
        className={`mt-8 block rounded-xl py-4 text-center font-semibold transition-colors ${
          highlighted
            ? 'bg-humidor-primary text-humidor-bg hover:bg-humidor-primary-light'
            : 'bg-humidor-border text-humidor-cream hover:bg-humidor-border/80'
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-16 pb-24 sm:pt-24 sm:pb-32">
        <div className="absolute inset-0 bg-gradient-to-b from-humidor-primary/5 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(196,165,116,0.15),transparent)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <img
            src="/cavaro-logo.png"
            alt="Cavaro"
            className="mx-auto h-auto w-[35rem] max-w-full"
          />
          <p className="mt-4 text-xl text-humidor-muted sm:text-2xl">
            Your personal cigar companion
          </p>
        </div>
      </section>

      {/* About */}
      <section className="px-6 pb-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-serif text-2xl font-semibold text-humidor-cream sm:text-3xl">
            Why Cavaro?
          </h2>
          <div className="mt-6 space-y-4 text-lg leading-relaxed text-humidor-muted">
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
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
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
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
              <p className="mt-3 font-medium text-humidor-cream">Track your collection</p>
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
              <p className="mt-3 font-medium text-humidor-cream">Favorites & notes</p>
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
                    d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"
                  />
                </svg>
              </div>
              <p className="mt-3 font-medium text-humidor-cream">Drink pairings</p>
            </div>
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-10 font-serif text-2xl font-semibold text-humidor-cream sm:text-3xl">
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
            />
          </div>

          <p className="mt-12 text-center text-humidor-muted">
            Download the app to sign up and get started. Premium subscribers get unlimited cigars and
            AI-powered drink pairing suggestions.
          </p>

          {/* App store links placeholder */}
          <div id="download" className="mt-10 flex flex-wrap justify-center gap-4">
            <a
              href="https://apps.apple.com/app/humidor"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-humidor-border bg-humidor-card px-6 py-3 text-humidor-cream transition-colors hover:border-humidor-primary hover:bg-humidor-card/80"
            >
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c1.33-1.54 1.12-3.75-.2-5.04-1.31-1.29-3.52-1.5-4.86.04-1.33 1.54-1.12 3.75.2 5.04 1.31 1.29 3.52 1.5 4.86-.04z" />
              </svg>
              App Store
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=com.glovermedia.humidor"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-humidor-border bg-humidor-card px-6 py-3 text-humidor-cream transition-colors hover:border-humidor-primary hover:bg-humidor-card/80"
            >
              <svg className="h-6 w-6" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"
                />
              </svg>
              Google Play
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-humidor-border px-6 py-8">
        <div className="mx-auto max-w-4xl text-center text-sm text-humidor-subtle">
          <p>Cavaro — Your personal cigar companion</p>
          <p className="mt-1">© {new Date().getFullYear()}</p>
        </div>
      </footer>
    </main>
  );
}