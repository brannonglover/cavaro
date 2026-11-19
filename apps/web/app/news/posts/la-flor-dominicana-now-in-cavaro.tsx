import Link from 'next/link';
import { BlogArticle } from '../../blog/components/BlogArticle';

const CIGARS = [
  {
    name: 'Double Ligero Chisel',
    line: 'Double Ligero',
    blurb: 'LFD’s signature chisel — bold, unmistakable, and built for aficionados.',
    image: '/news/lfd-double-ligero.jpg',
  },
  {
    name: 'Oro Chisel',
    line: 'Oro',
    blurb: 'Refined power wrapped in gold — a standout for any serious humidor.',
    image: '/news/lfd-oro-chisel.jpg',
  },
] as const;

export function LaFlorDominicanaCatalogPost() {
  return (
    <div className="mx-auto max-w-3xl">
      <BlogArticle>
        <p>
          We&apos;re thrilled to share that <strong>La Flor Dominicana</strong> cigars are now part
          of the Cavaro catalog.
        </p>
        <p>
          Known for bold blends, distinctive wrappers, and a reputation that precedes them in
          lounges and humidors alike, LFD is a brand collectors seek out — and one many of you have
          asked us to support.
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
                  alt={`La Flor Dominicana ${cigar.name}`}
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
          With access to their catalog, you can now find La Flor Dominicana cigars when you&apos;re
          adding to your humidor, logging a smoke, or building out your collection in Cavaro. Less
          guesswork. More of the sticks you actually smoke.
        </p>
        <p>
          This is another step toward making Cavaro the companion that knows the cigars you care
          about. More brands are on the way — and we&apos;ll keep you posted here.
        </p>
        <p>
          <Link href="/#download">Get the app</Link> and start tracking your LFD favorites today.
        </p>
      </BlogArticle>
    </div>
  );
}
