import Link from 'next/link';
import { SiteFooter } from './components/SiteFooter';
import { blogPosts } from './posts';

function formatDate(dateString: string) {
  return new Date(`${dateString}T12:00:00`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function BlogPage() {
  return (
    <main className="min-h-screen">
      <section className="relative overflow-hidden px-6 pt-10 pb-10 sm:pt-14 sm:pb-12">
        <div className="absolute inset-0 bg-gradient-to-b from-humidor-primary/5 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(196,165,116,0.15),transparent)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <h1 className="font-sans text-3xl font-semibold text-humidor-cream sm:text-4xl">Blog</h1>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-humidor-muted">
            Tips, techniques, and collector insights to help you get more from every smoke.
          </p>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="mx-auto grid max-w-4xl gap-8">
          {blogPosts.map((post) => (
            <article
              key={post.slug}
              className="overflow-hidden rounded-xl border border-humidor-border bg-humidor-card transition-colors hover:border-humidor-primary/50"
            >
              <Link href={`/blog/${post.slug}`} className="block">
                <img
                  src={post.heroImage}
                  alt={post.heroImageAlt}
                  className="aspect-[2/1] w-full object-cover"
                />
                <div className="p-6 sm:p-8">
                  <time
                    dateTime={post.publishedAt}
                    className="text-sm font-medium text-humidor-primary"
                  >
                    {formatDate(post.publishedAt)}
                  </time>
                  <h2 className="mt-2 font-sans text-2xl font-semibold text-humidor-cream">
                    {post.title}
                  </h2>
                  <p className="mt-3 leading-relaxed text-humidor-muted">{post.excerpt}</p>
                  <p className="mt-4 text-sm font-medium text-humidor-primary">Read article →</p>
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
