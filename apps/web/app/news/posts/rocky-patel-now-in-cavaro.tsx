import Link from 'next/link';
import { BlogArticle } from '../../blog/components/BlogArticle';

const CIGARS = [
  {
    name: 'Vintage 1990 Broadleaf',
    line: 'Vintage Series',
    blurb: 'A Rocky Patel classic — aged broadleaf wrapper, rich character, and unmistakable presence.',
    image: '/news/rocky-patel-vintage-1990.jpg',
  },
  {
    name: 'Decade',
    line: 'Decade',
    blurb: 'Built to celebrate ten years of craft — bold, refined, and made for serious humidors.',
    image: '/news/rocky-patel-decade.jpg',
  },
] as const;

export function RockyPatelCatalogPost() {
  return (
    <div className="mx-auto max-w-3xl">
      <BlogArticle>
        <p>
          We&apos;re excited to announce that <strong>Rocky Patel</strong> cigars are now part of
          the Cavaro catalog.
        </p>
        <p>
          From award-winning classics to limited releases, Rocky Patel has become one of the most
          recognizable names in premium cigars — and a favorite among collectors who know what they
          like.
        </p>
      </BlogArticle>

      <div className="my-10">
        <p className="mb-5 text-center text-xs font-medium uppercase tracking-[0.18em] text-humidor-primary">
          Featured from the catalog
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          {CIGARS.map((cigar) => (
            <figure
              key={cigar.name}
              className="group overflow-hidden rounded-xl border border-humidor-border bg-humidor-card transition duration-500 hover:border-humidor-primary/40"
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-humidor-bg">
                <img
                  src={cigar.image}
                  alt={`Rocky Patel ${cigar.name}`}
                  className="h-full w-full object-contain object-center transition duration-700 ease-out group-hover:scale-[1.02]"
                />
              </div>
              <figcaption className="border-t border-humidor-border px-5 py-4">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-humidor-primary">
                  {cigar.line}
                </p>
                <p className="mt-1 font-sans text-lg font-semibold text-humidor-cream">{cigar.name}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-humidor-muted">{cigar.blurb}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>

      <BlogArticle>
        <p>
          With their catalog in Cavaro, you can find Rocky Patel cigars when you&apos;re stocking
          your humidor, logging a smoke, or tracking what belongs in your rotation. The sticks you
          reach for — now easier to add, rate, and remember.
        </p>
        <p>
          This is another step toward making Cavaro the companion that knows the cigars you care
          about. More brands are on the way — and we&apos;ll keep you posted here.
        </p>
        <p>
          <Link href="/#download">Get the app</Link> and start tracking your Rocky Patel favorites
          today.
        </p>
      </BlogArticle>
    </div>
  );
}
