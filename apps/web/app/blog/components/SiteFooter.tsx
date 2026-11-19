import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="border-t border-humidor-border px-6 py-8">
      <div className="mx-auto max-w-4xl text-center text-sm text-humidor-subtle">
        <p>Cavaro — Your personal cigar companion</p>
        <p className="mt-1">
          <Link href="/news" className="text-humidor-primary hover:underline">
            News
          </Link>
          {' · '}
          <Link href="/blog" className="text-humidor-primary hover:underline">
            Blog
          </Link>
          {' · '}
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
  );
}
