import Link from 'next/link';

const SUPPORT_EMAIL = 'support@cavaroapp.com';

export default function DeleteAccountPage() {
  return (
    <main className="min-h-screen">
      <section className="relative overflow-hidden px-6 pt-10 pb-10 sm:pt-14 sm:pb-12">
        <div className="absolute inset-0 bg-gradient-to-b from-humidor-primary/5 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(196,165,116,0.15),transparent)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <h1 className="font-sans text-3xl font-semibold text-humidor-cream sm:text-4xl">
            Delete your Cavaro account
          </h1>
          <p className="mt-2 text-lg text-humidor-muted">
            Request deletion of your Cavaro account and associated data
          </p>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="mx-auto max-w-3xl space-y-8 text-humidor-muted">
          <div>
            <h2 className="mb-3 font-sans text-xl font-semibold text-humidor-cream">
              About this page
            </h2>
            <p className="leading-relaxed">
              This page explains how to delete your account for{' '}
              <strong className="text-humidor-cream">Cavaro</strong>, the personal cigar companion
              app. Deletion is permanent and cannot be undone.
            </p>
          </div>

          <div>
            <h2 className="mb-3 font-sans text-xl font-semibold text-humidor-cream">
              Delete your account in the app
            </h2>
            <ol className="list-decimal space-y-2 pl-5 leading-relaxed">
              <li>Open the Cavaro app and sign in with the account you want to delete.</li>
              <li>Open the account menu.</li>
              <li>Choose <strong className="text-humidor-cream">Delete account</strong>.</li>
              <li>Confirm deletion when prompted.</li>
            </ol>
            <p className="mt-4 leading-relaxed">
              When you delete from the app, your Cavaro account is removed immediately, along with
              associated server data and this device&apos;s local collection data.
            </p>
          </div>

          <div>
            <h2 className="mb-3 font-sans text-xl font-semibold text-humidor-cream">
              Request deletion by email
            </h2>
            <p className="leading-relaxed">
              If you cannot use the in-app option, email us from the address on your Cavaro account:
            </p>
            <p className="mt-3 leading-relaxed">
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Delete my Cavaro account')}`}
                className="text-humidor-primary hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
            </p>
            <p className="mt-3 leading-relaxed">
              Include the subject line <strong className="text-humidor-cream">Delete my Cavaro account</strong>{' '}
              and confirm the email address on the account. We aim to complete email deletion
              requests within <strong className="text-humidor-cream">30 days</strong>.
            </p>
          </div>

          <div>
            <h2 className="mb-3 font-sans text-xl font-semibold text-humidor-cream">
              What data is deleted
            </h2>
            <ul className="list-disc space-y-2 pl-5 leading-relaxed">
              <li>Your Cavaro account and authentication credentials</li>
              <li>Server-side profile data tied to your account</li>
              <li>Synced collection data and community reviews linked to your account</li>
              <li>Local collection data on the device when you delete from within the app</li>
            </ul>
            <p className="mt-4 leading-relaxed">
              We do not keep a copy of your account for continued use after deletion. Limited
              records may be retained only where required by law (for example, transaction records
              related to App Store or Google Play purchases, which are managed by Apple or Google).
            </p>
          </div>

          <div>
            <h2 className="mb-3 font-sans text-xl font-semibold text-humidor-cream">
              Questions
            </h2>
            <p className="leading-relaxed">
              Contact{' '}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-humidor-primary hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>{' '}
              if you need help with account deletion.
            </p>
          </div>
        </div>
      </section>

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
