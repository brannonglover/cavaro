import Link from 'next/link';
import { BlogArticle } from '../../blog/components/BlogArticle';

const BRANDS = [
  {
    name: 'Arturo Fuente',
    highlight: 'Don Carlos · OpusX · Hemingway',
    blurb:
      'From everyday classics to legendary limited releases — one of the most celebrated names in premium cigars is now in Cavaro.',
  },
  {
    name: 'Padrón',
    highlight: '1964 Anniversary · 1926 Serie · Family Reserve',
    blurb:
      'Benchmark Nicaraguan puros with decades of consistency. Track the sticks you cellar and the sizes you reach for most.',
  },
  {
    name: 'Davidoff',
    highlight: 'Aniversario · Winston Churchill · Grand Cru',
    blurb:
      'Swiss precision meets luxury tobacco tradition — now easier to find when you are building your rotation.',
  },
  {
    name: 'My Father',
    highlight: 'Flor de las Antillas · Le Bijou 1922 · La Promesa',
    blurb:
      'Pepin García’s flagship lines and family blends — from bold classics to award-winning favorites.',
  },
  {
    name: 'Oliva',
    highlight: 'Serie V Melanio · Serie V · Serie G',
    blurb:
      'Nicaraguan craftsmanship at scale, from approachable everyday smokes to collector-grade Melanio.',
  },
  {
    name: 'Perdomo',
    highlight: '10th Anniversary · Lot 23 · Reserve',
    blurb:
      'Broad appeal across Connecticut, sun-grown, and maduro — a humidor staple for many aficionados.',
  },
  {
    name: 'AJ Fernandez',
    highlight: 'New World · San Lotano · Bellas Artes',
    blurb:
      'Modern classics with wide flavor range — from value-forward New World to refined Bellas Artes.',
  },
  {
    name: 'Plasencia',
    highlight: 'Alma Fuerte · Alma del Campo · Reserva Original',
    blurb:
      'Six generations of tobacco heritage — boutique Nicaraguan blends for the discerning humidor.',
  },
] as const;

export function EightBrandsJoinCavaroPost() {
  return (
    <div className="mx-auto max-w-3xl">
      <BlogArticle>
        <p>
          We&apos;ve added <strong>eight major cigar brands</strong> to the Cavaro catalog — over
          700 new cigars to find, track, and journal.
        </p>
        <p>
          Whether you are stocking your humidor, logging a smoke, or building a rotation you can
          actually remember, these are the names collectors reach for — and they are live in Cavaro
          now.
        </p>
      </BlogArticle>

      <div className="my-10">
        <p className="mb-5 text-center text-xs font-medium uppercase tracking-[0.18em] text-humidor-primary">
          Now in Cavaro
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {BRANDS.map((brand) => (
            <article
              key={brand.name}
              className="rounded-xl border border-humidor-border bg-humidor-card px-5 py-4 transition duration-500 hover:border-humidor-primary/40"
            >
              <h2 className="font-sans text-lg font-semibold text-humidor-cream">{brand.name}</h2>
              <p className="mt-1.5 text-xs font-medium uppercase tracking-[0.12em] text-humidor-primary">
                {brand.highlight}
              </p>
              <p className="mt-2.5 text-sm leading-relaxed text-humidor-muted">{brand.blurb}</p>
            </article>
          ))}
        </div>
      </div>

      <BlogArticle>
        <p>
          This is our biggest catalog expansion yet. You can search by brand, line, and vitola when
          adding cigars to your humidor or logging a session — less guesswork, more of the sticks
          you actually smoke.
        </p>
        <p>
          We will keep announcing new additions here as the catalog grows. If there is a brand you
          want to see next, let us know.
        </p>
        <p>
          <Link href="/#download">Get the app</Link> and start tracking your favorites today.
        </p>
      </BlogArticle>
    </div>
  );
}
