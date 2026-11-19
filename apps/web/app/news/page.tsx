import Link from 'next/link';
import { SiteFooter } from '../blog/components/SiteFooter';
import { newsPosts } from './posts';

function formatDate(dateString: string) {
  return new Date(`${dateString}T12:00:00`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function NewsPage() {
  return (
    <main className="min-h-screen">
      <section className="relative overflow-hidden px-6 pt-10 pb-10 sm:pt-14 sm:pb-12">
        <div className="absolute inset-0 bg-gradient-to-b from-humidor-primary/5 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(196,165,116,0.15),transparent)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <h1 className="font-sans text-3xl font-semibold text-humidor-cream sm:text-4xl">News</h1>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-humidor-muted">
            Product updates, feature launches, and announcements from the Cavaro team.
          </p>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {newsPosts.map((post) => (
            <article
              key={post.slug}
              className="overflow-hidden rounded-xl border border-humidor-border bg-humidor-card transition-colors hover:border-humidor-primary/50"
            >
              <Link href={`/news/${post.slug}`} className="flex flex-col sm:flex-row">
                {post.heroCollage ? (
                  <div className="flex aspect-[16/9] w-full items-center justify-center bg-humidor-bg/60 p-4 sm:aspect-auto sm:w-48 sm:shrink-0 sm:p-3">
                    <div className="grid w-full max-w-[9rem] grid-cols-4 gap-2 sm:max-w-none">
                      {post.heroCollage.map((logo) => (
                        <div key={logo.alt} className="flex h-7 items-center justify-center sm:h-8">
                          <img
                            src={logo.src}
                            alt={logo.alt}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  post.heroImage && (
                    <div className="flex aspect-[16/9] w-full items-center justify-center bg-humidor-bg/60 p-6 sm:aspect-auto sm:w-48 sm:shrink-0 sm:p-4">
                      <img
                        src={post.heroImage}
                        alt={post.heroImageAlt ?? ''}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  )
                )}
                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <time
                    dateTime={post.publishedAt}
                    className="text-xs font-medium text-humidor-primary sm:text-sm"
                  >
                    {formatDate(post.publishedAt)}
                  </time>
                  <h2 className="mt-2 font-sans text-xl font-semibold leading-snug text-humidor-cream">
                    {post.title}
                  </h2>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-humidor-muted sm:text-base">
                    {post.excerpt}
                  </p>
                  <p className="mt-4 text-sm font-medium text-humidor-primary">Read more →</p>
                </div>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
