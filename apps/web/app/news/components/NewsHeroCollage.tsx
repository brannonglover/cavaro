type Logo = {
  src: string;
  alt: string;
};

type NewsHeroCollageProps = {
  logos: Logo[];
  label?: string;
};

export function NewsHeroCollage({ logos, label = 'Now in Cavaro' }: NewsHeroCollageProps) {
  return (
    <section className="relative px-6 pb-8">
      <div className="relative mx-auto max-w-3xl overflow-hidden rounded-xl border border-humidor-primary/25 bg-humidor-card">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_80%_at_50%_40%,rgba(196,165,116,0.22),transparent_70%)]" />
        <div className="pointer-events-none absolute -left-16 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-humidor-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-humidor-primary/10 blur-3xl" />
        <div className="relative px-6 py-10 sm:px-10 sm:py-12">
          <p className="mb-8 text-center text-xs font-medium uppercase tracking-[0.2em] text-humidor-primary">
            {label}
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4 sm:gap-x-8 sm:gap-y-10">
            {logos.map((logo) => (
              <div
                key={logo.alt}
                className="flex h-16 items-center justify-center sm:h-20"
              >
                <img
                  src={logo.src}
                  alt={logo.alt}
                  className="max-h-full max-w-full object-contain drop-shadow-[0_0_18px_rgba(196,165,116,0.18)]"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
