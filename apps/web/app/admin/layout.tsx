export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-humidor-bg">
      <div className="border-b border-humidor-border bg-humidor-card px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <h1 className="font-sans text-xl font-semibold text-humidor-cream">
            Cavaro Admin
          </h1>
          <a
            href="/"
            className="text-sm text-humidor-muted hover:text-humidor-primary"
          >
            ← Back to site
          </a>
        </div>
      </div>
      <div className="mx-auto max-w-4xl px-6 py-8">{children}</div>
    </div>
  );
}
