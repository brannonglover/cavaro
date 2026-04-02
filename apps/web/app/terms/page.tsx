import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-10 pb-10 sm:pt-14 sm:pb-12">
        <div className="absolute inset-0 bg-gradient-to-b from-humidor-primary/5 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(196,165,116,0.15),transparent)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <h1 className="font-sans text-3xl font-semibold text-humidor-cream sm:text-4xl">
            Terms of Use
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
              Acceptance of Terms
            </h2>
            <p className="leading-relaxed">
              By accessing or using Cavaro, you agree to be bound by these Terms of Use. If you do
              not agree to these terms, please do not use the app. These terms apply to all users of
              the service, including registered account holders and visitors.
            </p>
          </div>

          <div>
            <h2 className="mb-3 font-sans text-xl font-semibold text-humidor-cream">
              Eligibility
            </h2>
            <p className="leading-relaxed">
              Cavaro is intended for adults of legal smoking age in their jurisdiction. By creating an
              account and using the app, you confirm that you meet the minimum age requirement in your
              country or region. If you do not meet this requirement, you may not use the service.
            </p>
          </div>

          <div>
            <h2 className="mb-3 font-sans text-xl font-semibold text-humidor-cream">
              Account Registration
            </h2>
            <p className="leading-relaxed">
              You must register for an account to use Cavaro. You are responsible for maintaining the
              confidentiality of your login credentials and for all activity that occurs under your
              account. You agree to provide accurate information during registration and to keep it up
              to date.
            </p>
          </div>

          <div>
            <h2 className="mb-3 font-sans text-xl font-semibold text-humidor-cream">
              Acceptable Use
            </h2>
            <p className="leading-relaxed">
              You agree to use Cavaro only for its intended purpose—tracking your personal cigar
              collection, logging tasting notes, and discovering drink pairings. You may not use the
              service for any unlawful purpose, attempt to interfere with the app&apos;s operation, or
              access another user&apos;s account without permission.
            </p>
          </div>

          <div>
            <h2 className="mb-3 font-sans text-xl font-semibold text-humidor-cream">
              Your Content
            </h2>
            <p className="leading-relaxed">
              Any data you enter into Cavaro—such as cigar details, tasting notes, ratings, and
              collection information—remains yours. You retain all rights to your content. By using
              the service, you grant Cavaro a limited license to store and display your content solely
              to provide the service to you.
            </p>
          </div>

          <div>
            <h2 className="mb-3 font-sans text-xl font-semibold text-humidor-cream">
              Premium Features & Payments
            </h2>
            <p className="leading-relaxed">
              Cavaro may offer premium features available through a paid subscription. Payment is
              processed via Apple In-App Purchase. By subscribing, you agree to Apple&apos;s terms of
              service and the applicable pricing and billing terms displayed at the time of purchase.
              Subscriptions renew automatically unless cancelled through your Apple ID settings before
              the renewal date. Refunds are handled by Apple in accordance with their refund policies.
            </p>
          </div>

          <div>
            <h2 className="mb-3 font-sans text-xl font-semibold text-humidor-cream">
              Intellectual Property
            </h2>
            <p className="leading-relaxed">
              All content, design, branding, and software associated with Cavaro are the property of
              Cavaro and are protected by applicable intellectual property laws. You may not copy,
              modify, distribute, or reverse-engineer any part of the service without prior written
              consent.
            </p>
          </div>

          <div>
            <h2 className="mb-3 font-sans text-xl font-semibold text-humidor-cream">
              Disclaimers
            </h2>
            <p className="leading-relaxed">
              Cavaro is provided &quot;as is&quot; and &quot;as available&quot; without warranties of
              any kind, express or implied. We do not guarantee that the service will be
              uninterrupted, error-free, or free of harmful components. Drink pairing suggestions are
              generated for informational purposes and should not be considered professional advice.
            </p>
          </div>

          <div>
            <h2 className="mb-3 font-sans text-xl font-semibold text-humidor-cream">
              Limitation of Liability
            </h2>
            <p className="leading-relaxed">
              To the fullest extent permitted by law, Cavaro and its operators shall not be liable for
              any indirect, incidental, special, or consequential damages arising from your use of the
              service. Our total liability for any claim related to the service is limited to the
              amount you paid, if any, during the twelve months preceding the claim.
            </p>
          </div>

          <div>
            <h2 className="mb-3 font-sans text-xl font-semibold text-humidor-cream">
              Termination
            </h2>
            <p className="leading-relaxed">
              We reserve the right to suspend or terminate your account at any time if you violate
              these terms or engage in conduct that is harmful to other users or the service. You may
              also delete your account at any time. Upon termination, your right to use the service
              ceases immediately.
            </p>
          </div>

          <div>
            <h2 className="mb-3 font-sans text-xl font-semibold text-humidor-cream">
              Changes to These Terms
            </h2>
            <p className="leading-relaxed">
              We may update these Terms of Use from time to time. The &quot;Last updated&quot; date at
              the top of this page indicates when the terms were last revised. Continued use of Cavaro
              after changes constitutes acceptance of the updated terms.
            </p>
          </div>

          <div>
            <h2 className="mb-3 font-sans text-xl font-semibold text-humidor-cream">
              Contact Us
            </h2>
            <p className="leading-relaxed">
              If you have questions about these Terms of Use, please contact us at{' '}
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
            <Link href="/privacy" className="text-humidor-primary hover:underline">
              Privacy Policy
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
