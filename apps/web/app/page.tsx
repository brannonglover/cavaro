import Link from 'next/link';
import { GetStartedButton } from './components/GetStartedButton';
import { DownloadSection } from './components/DownloadSection';

const FREE_CIGAR_LIMIT = 5;

function TierCard({
  title,
  price,
  features,
  cta,
  href,
  highlighted,
  download,
}: {
  title: string;
  price: string;
  features: string[];
  cta: string;
  href: string;
  highlighted?: boolean;
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
      {download ? (
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
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-humidor-muted/90">
            Know your collection. Understand your taste. Choose your next cigar with confidence.
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
              Cavaro is more than a humidor tracker. It&apos;s a premium companion that helps you
              manage what&apos;s in your humidor, remember every cigar you&apos;ve smoked,
              understand your palate, and choose better cigars over time.
            </p>
            <p>
              Whether you&apos;re cataloging current inventory, journaling tasting notes, cellaring
              cigars for aging, or deciding what to smoke tonight — Cavaro learns from your
              experience and grows with your collection.
            </p>
          </div>

          {/* Benefits */}
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
              <p className="mt-2 font-medium text-humidor-cream">Humidor inventory</p>
              <p className="mt-1 text-sm text-humidor-muted">
                Track what you have on hand across multiple humidors
              </p>
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
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
              <p className="mt-2 font-medium text-humidor-cream">Smoking journal</p>
              <p className="mt-1 text-sm text-humidor-muted">
                Log ratings, flavors, and detailed tasting notes
              </p>
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
              <p className="mt-2 font-medium text-humidor-cream">Your palate</p>
              <p className="mt-1 text-sm text-humidor-muted">
                See what you love, what to revisit, and what to buy next
              </p>
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
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <p className="mt-2 font-medium text-humidor-cream">Intentional cellaring</p>
              <p className="mt-1 text-sm text-humidor-muted">
                Age cigars on your timeline with ready-to-smoke alerts
              </p>
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
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>
              <p className="mt-2 font-medium text-humidor-cream">Tonight&apos;s pick</p>
              <p className="mt-1 text-sm text-humidor-muted">
                Get personalized smoke recommendations from your humidor
              </p>
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
              <p className="mt-1 text-sm text-humidor-muted">
                Elevate every session with AI-powered pairing suggestions
              </p>
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
                'Humidor inventory & collection stats',
                'Smoking journal & taste profile',
                'Basic tasting notes',
              ]}
              cta="Get started"
              href="#download"
              download
            />
            <TierCard
              title="Premium"
              price="$2.99/mo"
              features={[
                'Unlimited cigars & favorites',
                'Strength profile across thirds',
                'Cigar photos',
                'AI-powered drink pairings',
              ]}
              cta="Get the App"
              href="#download"
              highlighted
              download
            />
          </div>

          <p className="mt-12 text-center text-humidor-muted">
            Download the app to sign up and get started. Cavaro learns your palate as you journal —
            the more you smoke and rate, the smarter your recommendations become.
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
            <Link href="/terms" className="text-humidor-primary hover:underline">
              Terms of Use
            </Link>
            {' · '}
            © {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </main>
  );
}