import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-10 pb-10 sm:pt-14 sm:pb-12">
        <div className="absolute inset-0 bg-gradient-to-b from-humidor-primary/5 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(196,165,116,0.15),transparent)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <h1 className="font-sans text-3xl font-semibold text-humidor-cream sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-2 text-lg text-humidor-muted">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-3xl space-y-8 text-humidor-muted">
          <div>
            <h2 className="mb-3 font-sans text-xl font-semibold text-humidor-cream">
              About Cavaro
            </h2>
            <p className="leading-relaxed">
              Cavaro is a personal cigar companion app designed to help you track your cigar
              collection, log tasting notes, and discover drink pairings. The app is intended for
              cigar enthusiasts who want to catalog their collection and get the most from every
              smoke. To use Cavaro, you must create an account and register.
            </p>
          </div>

          <div>
            <h2 className="mb-3 font-sans text-xl font-semibold text-humidor-cream">
              We Do Not Collect, Use, or Sell Your Data
            </h2>
            <p className="leading-relaxed">
              Cavaro does not collect your personal data for marketing, analytics, or any other
              commercial purpose. We do not sell, rent, or share your data with third parties.
              Your cigar collection, tasting notes, and preferences are yours alone.
            </p>
          </div>

          <div>
            <h2 className="mb-3 font-sans text-xl font-semibold text-humidor-cream">
              Account & Registration
            </h2>
            <p className="leading-relaxed">
              Registration is required to use the app. When you create an account, we store only
              the information necessary to authenticate you and provide the service—such as your
              email address and account credentials. This information is used solely to manage
              your account and is not used for advertising or sold to third parties.
            </p>
          </div>

          <div>
            <h2 className="mb-3 font-sans text-xl font-semibold text-humidor-cream">
              Your Data Stays With You
            </h2>
            <p className="leading-relaxed">
              Your cigar collection, tasting notes, favorites, and other app data are stored on
              your device. We do not harvest this data for our own use. Premium features such as
              AI drink pairing may require sending limited information to our servers to provide
              the service, but we do not retain or use that data beyond fulfilling your request.
            </p>
          </div>

          <div>
            <h2 className="mb-3 font-sans text-xl font-semibold text-humidor-cream">
              Changes to This Policy
            </h2>
            <p className="leading-relaxed">
              We may update this Privacy Policy from time to time. The &quot;Last updated&quot; date at the
              top of this page indicates when the policy was last revised. Continued use of Cavaro
              after changes constitutes acceptance of the updated policy.
            </p>
          </div>

          <div>
            <h2 className="mb-3 font-sans text-xl font-semibold text-humidor-cream">
              Contact Us
            </h2>
            <p className="leading-relaxed">
              If you have questions about this Privacy Policy or how we handle your data, please
              contact us at{' '}
              <a
                href="mailto:support@cavaroapp.com"
                className="text-humidor-primary hover:underline"
              >
                support@cavaroapp.com
              </a>
              .
            </p>
          </div>
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
            <Link href="/" className="text-humidor-primary hover:underline">
              Home
            </Link>
            {' · '}
            © {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </main>
  );
}
